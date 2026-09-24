'use strict';
const { DateTime } = require('luxon');
const ZONE = process.env.TZ_APP || 'Asia/Kolkata';

/* ───────────────────────── amount ───────────────────────── */

/**
 * Bank SMS write amounts every possible way:
 *   Rs.1,234.00 · INR 1234 · ₹1234.5 · Rs 1.2L · Rs. 45,000/-
 * Returns integer PAISE, or null. Never floats (§6.1).
 */
function toPaise(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().replace(/^(?:rs\.?|inr|₹)\s*/i, '').replace(/\/-$/, '');

  // Indian shorthand: 1.2L / 2Cr / 15K
  const shorthand = s.match(/^([\d,]+(?:\.\d+)?)\s*(L|LAC|LAKH|CR|CRORE|K)$/i);
  if (shorthand) {
    const n = Number(shorthand[1].replace(/,/g, ''));
    const unit = shorthand[2].toUpperCase();
    const mult = unit === 'K' ? 1e3 : unit.startsWith('CR') ? 1e7 : 1e5;
    return Math.round(n * mult * 100);
  }

  s = s.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

const toRupees = (paise) => (paise === null || paise === undefined ? null : paise / 100);

// The (?![A-Za-z]) is load-bearing: without it "Rs.85,000.00 credited" reads
// the "cr" of "credited" as the crore multiplier and returns 8.5 trillion.
const AMOUNT_RE = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(L|LAC|LAKH|CR|CRORE|K)?(?![A-Za-z])/i;

// SBI and a few others omit the currency entirely: "debited by 180.0".
const BARE_AMOUNT_RE = /\b(?:debited|credited|debit|credit|spent|paid|sent|withdrawn)\s+(?:by|for|with|of)?\s*([\d,]+(?:\.\d{1,2})?)\b/i;

function extractAmount(body) {
  const m = body.match(AMOUNT_RE);
  if (m) return toPaise(m[1] + (m[2] || ''));
  const bare = body.match(BARE_AMOUNT_RE);
  if (bare) return toPaise(bare[1]);
  return null;
}

/* ───────────────────────── date ───────────────────────── */

const DATE_FORMATS = [
  'dd-MM-yy', 'dd-MM-yyyy', 'dd/MM/yy', 'dd/MM/yyyy',
  'dd-LLL-yy', 'dd-LLL-yyyy', 'ddLLLyy', 'ddLLLyyyy',
  'dd LLL yy', 'dd LLL yyyy', 'yyyy-MM-dd',
];

/**
 * Bank SMS often state a date that is NOT today ("on 21-Sep-26"). Parse it —
 * defaulting to receivedAt when the text disagrees puts a delayed message in
 * the wrong day's budget (§11.5).
 */
function extractOccurredAt(body, fallback = new Date()) {
  const m = body.match(/\b(\d{1,2}[-/\s]?[A-Za-z]{3}[-/\s]?\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
  if (!m) return fallback;

  const raw = m[1].replace(/\s+/g, ' ').trim();
  for (const fmt of DATE_FORMATS) {
    const dt = DateTime.fromFormat(raw, fmt, { zone: ZONE });
    if (dt.isValid) {
      // Guard against a misread producing something absurd.
      const now = DateTime.now().setZone(ZONE);
      if (dt > now.plus({ days: 2 }) || dt < now.minus({ years: 6 })) return fallback;

      // Carry the clock time from receivedAt — SMS dates have no time part,
      // and midnight would put late-night spends on the wrong side of a day.
      const rec = DateTime.fromJSDate(fallback).setZone(ZONE);
      return dt.set({ hour: rec.hour, minute: rec.minute, second: rec.second }).toJSDate();
    }
  }
  return fallback;
}

/* ───────────────────────── redaction ───────────────────────── */

/**
 * last4 only. Any digit run longer than 4 that looks like an account or card
 * number is masked BEFORE the raw message is written, and before any LLM
 * prompt is built (§9).
 */
function redact(body) {
  return String(body)
    .replace(/\b(?:\d[ -]?){12,19}\b/g, (m) => 'XXXXXXXX' + m.replace(/\D/g, '').slice(-4))
    .replace(/\b([Xx*]{2,})(\d{5,})\b/g, (_, x, d) => x + d.slice(-4));
}

function extractLast4(body) {
  const m =
    body.match(/(?:a\/?c|acct|account|card)(?:\s*(?:no\.?|number|ending(?:\s*(?:in|with))?))?\s*[:#]?\s*(?:[xX*]+\s*)?(\d{4})\b/i) ||
    body.match(/[xX*]{2,}\s?(\d{4})\b/);
  return m ? m[1] : null;
}

/* ───────────────────────── method & direction ───────────────────────── */

function detectMethod(body) {
  const b = body.toLowerCase();
  if (/\bupi\b|vpa|@[a-z]{2,}\b|bhim|gpay|google pay|phonepe|paytm/.test(b)) return 'upi';
  if (/\batm\b|cash withdraw/.test(b)) return 'atm';
  if (/\bimps\b/.test(b)) return 'imps';
  if (/\bneft\b|\brtgs\b/.test(b)) return 'neft';
  if (/auto[- ]?debit|standing instruction|\bsi\b|mandate|e-?nach|ecs/.test(b)) return 'auto_debit';
  if (/card|swipe|pos\b|spent on|txn on card/.test(b)) return 'card';
  if (/net ?banking|ib(?:ft)?\b/.test(b)) return 'netbanking';
  return 'unknown';
}

const DEBIT_WORDS = /\b(debited|debit|spent|paid|withdrawn|sent|purchase|deducted|transferred to|trf to)\b/i;
const CREDIT_WORDS = /\b(credited|credit|received|deposited|refund(?:ed)?|reversed|cashback)\b/i;

function detectDirection(body) {
  const debit = DEBIT_WORDS.test(body);
  const credit = CREDIT_WORDS.test(body);
  if (debit && !credit) return 'debit';
  if (credit && !debit) return 'credit';
  if (debit && credit) {
    // "debited ... credited to beneficiary" — the first verb wins.
    const di = body.search(DEBIT_WORDS);
    const ci = body.search(CREDIT_WORDS);
    return di < ci ? 'debit' : 'credit';
  }
  return null;
}

/* ───────────────────────── reference id ───────────────────────── */

function extractRefId(body) {
  const m =
    body.match(/\b(?:upi|ref|rrn|txn|transaction|utr)[\s:#]*(?:no\.?|id|ref(?:no)?)?[\s:#]*([A-Z0-9]{6,25})\b/i) ||
    body.match(/\bref(?:no)?[\s:#]*([A-Z0-9]{6,25})\b/i);
  if (!m) return null;
  const id = m[1].toUpperCase();
  if (/^\d{1,5}$/.test(id)) return null;   // too short to be unique
  return id;
}

/* ───────────────────────── merchant ───────────────────────── */

const MERCHANT_NOISE = /\b(upi|ref|refno|rrn|txn|utr|no|not you|call|sms|block|avl|bal|balance|limit|lmt|info|dear|customer|a\/c|ac|acct|account|on|to|from|via|at|by|inr|rs)\b/gi;

function cleanMerchant(raw) {
  if (!raw) return null;
  let s = String(raw)
    .replace(/@[a-z0-9.\-_]+/gi, ' ')       // strip the VPA handle: swiggy@ybl → swiggy
    .replace(/[*_\-/|.]+/g, ' ')
    .replace(/\d{4,}/g, ' ')
    .replace(MERCHANT_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s || s.length < 2) return null;
  return s
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Normalized lookup key for fin_merchants: 'SWIGGY*ORDER' → 'swiggy'. */
function merchantKey(nameOrRaw) {
  if (!nameOrRaw) return null;
  const s = String(nameOrRaw)
    .toLowerCase()
    .replace(/@[a-z0-9.\-_]+/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
  return s || null;
}

/* ───────────────────────── isExpense (§6.2) ───────────────────────── */

const DECLINED_RE = /\b(declined|failed|not processed|unsuccessful|could not be|reversal pending|on hold)\b/i;
const CC_BILL_RE = /\b(credit card (?:bill|payment)|card payment received|payment (?:towards|received for) .{0,20}card|cc ?bill)\b/i;
const INVESTMENT_RE = /\b(sip|mutual fund|mf purchase|zerodha|groww|upstox|kuvera|coin\b|nps\b|ppf\b|rd installment|recurring deposit|folio)\b/i;
const REFUND_RE = /\b(refund(?:ed)?|reversed|reversal|chargeback)\b/i;
const SELF_TRANSFER_RE = /\b(self|own account|transfer to self|imps to self)\b/i;

/**
 * The single biggest correctness trap. Returns:
 *   { isExpense, category?, drop?, reason }
 * `drop:true` means do not create a transaction at all.
 */
function classify({ body = '', direction, merchantKey: mKey, user }) {
  const b = String(body);

  if (DECLINED_RE.test(b)) {
    return { drop: true, isExpense: false, reason: 'declined_or_failed' };
  }

  if (direction === 'credit') {
    if (REFUND_RE.test(b)) return { isExpense: false, reason: 'refund' };
    return { isExpense: false, reason: 'credit_not_expense' };
  }

  if (CC_BILL_RE.test(b)) {
    // The card spends were already counted when they happened. Counting the
    // bill too doubles the month.
    return { isExpense: false, category: 'transfer', reason: 'credit_card_bill_payment' };
  }

  if (INVESTMENT_RE.test(b)) {
    return { isExpense: false, category: 'investment', reason: 'investment_debit' };
  }

  if (SELF_TRANSFER_RE.test(b)) {
    return { isExpense: false, category: 'transfer', reason: 'self_transfer_keyword' };
  }

  // Merchant matches one of the user's own accounts / UPI handles.
  if (user && mKey) {
    const own = [
      ...(user.upiHandles || []).map(merchantKey),
      ...(user.accounts || []).map((a) => merchantKey(a.nickname || a.bankName)),
    ].filter(Boolean);
    if (own.includes(mKey)) {
      return { isExpense: false, category: 'transfer', reason: 'self_account_match' };
    }
  }

  return { isExpense: true, reason: 'expense' };
}

module.exports = {
  ZONE,
  toPaise, toRupees, extractAmount, AMOUNT_RE, BARE_AMOUNT_RE,
  extractOccurredAt,
  redact, extractLast4,
  detectMethod, detectDirection,
  extractRefId,
  cleanMerchant, merchantKey,
  classify,
};
