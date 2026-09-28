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

// Gate 1 — DLT sender header: AD-HDFCBK, VM-ICICIB, JD-SBIUPI, AD-SBI, PAYTM, CRED, GPAY…
// Supports 2-character operator prefix (optional hyphen) + 3–10 alphanumeric chars,
// or standalone 3–10 char headers, while strictly rejecting personal phone numbers.
export function isBankSender(sender: string): boolean {
  if (!sender) return false;
  const s = sender.trim().replace(/^\+91/, '').replace(/^91(?=[A-Za-z]{2}-)/, '');
  // Reject personal phone numbers (+9198..., 9876543210, etc.)
  if (/^\+?\d{7,15}$/.test(s)) return false;
  // Match TRAI DLT headers: e.g. AD-SBI, VM-HDFCBK, VK-PAYTM or HDFCBK, SBI, PAYTM, CRED
  return /^(?:[A-Za-z]{2}-?)?[A-Za-z0-9]{3,10}$/.test(s);
}

// Gate 2 — a rupee amount is present.
const AMOUNT_RE = /(?:rs\.?|inr|₹)\s?[\d,]+(?:\.\d{1,2})?/i;

// Some banks omit the currency: "debited by 180.0".
const BARE_AMOUNT_RE = /\b(?:debited|credited|spent|paid|sent|withdrawn)\s+(?:by|for|with|of)?\s*[\d,]+(?:\.\d{1,2})?\b/i;

// Gate 3 — transactional vocabulary.
const TXN_RE = /debited|credited|spent|paid|received|withdrawn|txn|upi|a\/c|card ending|purchase|sent\s+rs/i;

// Gate 4 — NOT an OTP or promo.
// Mandatory safety warnings (e.g. "Never share your OTP/PIN", "If not you click here")
// are appended by RBI regulation to legitimate debit SMS. We must ONLY exclude if
// it is an actual OTP authorization message or marketing offer.
const CONFIRMED_TXN_RE = /\b(?:debited|credited|spent|withdrawn|sent\s+(?:rs|inr|₹)|paid\s+(?:rs|inr|₹|to)|transfer(?:red)?\s+to|purchase\s+of)\b/i;
const STRICT_OTP_RE = /(?:is\s+(?:your\s+|the\s+)?otp\b|\botp\s+(?:is|to\s+approve|to\s+complete)\b|\buse\s+otp\b|\bvalid\s+for\s+\d+\s*min|\bexpires\s+in\s+\d+\s*min)/i;
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
