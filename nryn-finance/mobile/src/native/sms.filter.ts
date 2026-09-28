/**
 * THE PRIVACY BOUNDARY (plan §3.3).
 *
 * This runs on the phone, before any network call. A message that does not
 * pass all four gates never leaves the device — not to your server, not to an
 * LLM, not anywhere. Personal SMS are not "filtered later"; they never travel.
 *
 * Be GENEROUS on inclusion and STRICT on the OTP/marketing exclusion:
 *   a false positive costs one wasted regex pass on the server;
 *   a false negative silently loses a transaction you will never notice.
 */

// Gate 1 — DLT sender header: AD-HDFCBK, AD-HDFCBK-S, VM-ICICIB-T, JD-SBIUPI, AD-SBI-S, BP-MAHABK-S, PAYTM, CRED, GPAY…
// Distinguish enterprise/bank TRAI headers from personal mobile phone numbers.
export function isBankSender(sender: string): boolean {
  if (!sender) return false;
  const s = String(sender).trim();
  // Reject personal phone numbers (+9198..., 9876543210, +1 555..., etc.)
  const digitsOnly = s.replace(/[\s\-+()]/g, '');
  if (/^\d{10,15}$/.test(digitsOnly)) return false;

  // Any DLT header / bank name has at least 2 letters (e.g. AD-SBI, AD-SBI-S, HDFCBK, MAHABK, PAYTM)
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 2) return true;

  // 3-6 digit bank / service shortcodes (e.g. 567676, 561616)
  if (/^\d{3,6}$/.test(digitsOnly)) return true;

  return false;
}

// Gate 2 — a rupee amount is present (supports Rs, INR, ₹, रु).
const AMOUNT_RE = /(?:rs\.?|inr|₹|रु\.?)\s*[\d,]+(?:\.\d{1,2})?/i;

// Some banks omit the currency: "debited by 180.0", "debited for 500", "नावे 200".
const BARE_AMOUNT_RE = /\b(?:debited|credited|debit|credit|spent|paid|sent|withdrawn|transferred|trf|naave|jama|नावे|जमा)\s+(?:by|for|with|of)?\s*[\d,]+(?:\.\d{1,2})?\b/i;

// Gate 3 — transactional vocabulary.
const TXN_RE = /\b(?:debit(?:ed)?|credit(?:ed)?|spent|paid|pay(?:ment)?|received|withdrawn|withdraw(?:al)?|txn|trans(?:action)?|transferred|transfer|trf|upi|imps|neft|rtgs|a\/c|acct?|account|card(?:\s+ending|\s+no)?|purchase|sent|deposited|refund|naave|jama|नावे|जमा|खाते)\b/i;

// Gate 4 — NOT an OTP or promo.
// Mandatory safety warnings (e.g. "Never share your OTP/PIN", "If not you click here")
// are appended by RBI regulation to legitimate debit SMS. We must ONLY exclude if
// it is an actual OTP authorization prompt or loan/promo offer.
const CONFIRMED_TXN_RE = /\b(?:debited|credited|spent|withdrawn|sent\s+(?:rs|inr|₹|रु)|paid\s+(?:rs|inr|₹|रु|to)|transfer(?:red)?\s+to|purchase\s+of|debit\s+of|naave|नावे|जमा)\b/i;
const STRICT_OTP_RE = /(?:is\s+(?:your\s+|the\s+)?otp\b|\botp\s+(?:is|to\s+approve|to\s+complete|for\s+(?:login|transaction|payment|verification)|sent\s+to)\b|\buse\s+otp\b|\bsecret\s+otp\b|\blogin\s+otp\b|\bvalid\s+for\s+\d+\s*min|\bexpires\s+in\s+\d+\s*min|\bone[- ]time\s+password\s+(?:is|to))/i;
const PROMO_RE = /\b(?:pre-?approved\s+(?:loan|offer|card|limit)|apply\s+now|avail\s+loan|get\s+instant\s+loan|loan\s+(?:offer|upto|up\s+to)|emi\s+offer|congratulations\s+you\s+are\s+eligible)\b/i;

export function isExcluded(body: string): boolean {
  if (CONFIRMED_TXN_RE.test(body)) {
    if (STRICT_OTP_RE.test(body)) return true;
    if (PROMO_RE.test(body)) return true;
    return false;
  }
  return /\b(?:otp|one[- ]time password|pre-?approved|apply now|loan offer|emi offer|win\b|congratulations|cashback upto)\b/i.test(body);
}

export type RawSms = { _id: string; address: string; body: string; date: number };

export type RejectReason = 'sender' | 'amount' | 'txn_words' | 'excluded' | null;

/**
 * Returns the reason a message was rejected, or null if it passes.
 * We keep the REASON (and the sender) for local debugging — never the body.
 */
export function rejectReason(sms: RawSms): RejectReason {
  const sender = (sms.address || '').trim();
  const body = sms.body || '';

  if (!isBankSender(sender)) return 'sender';
  if (isExcluded(body)) return 'excluded';
  if (!AMOUNT_RE.test(body) && !BARE_AMOUNT_RE.test(body)) return 'amount';
  if (!TXN_RE.test(body)) return 'txn_words';
  return null;
}

export const isTransactional = (sms: RawSms) => rejectReason(sms) === null;

export function filterTransactional(messages: RawSms[]) {
  const kept: RawSms[] = [];
  const rejected: Record<string, number> = {};
  for (const m of messages) {
    const reason = rejectReason(m);
    if (reason === null) kept.push(m);
    else rejected[reason] = (rejected[reason] || 0) + 1;
  }
  return { kept, rejected };
}
