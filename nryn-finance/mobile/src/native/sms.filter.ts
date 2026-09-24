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

// Gate 1 — DLT sender header: AD-HDFCBK, VM-ICICIB, JD-SBIUPI, JM-HDFCBK…
// Match the 4–8 letter BODY, never the full header: the two-letter operator
// prefix changes without warning (§11.3).
const SENDER_RE = /^[A-Z]{2}-?[A-Z]{4,8}$/i;

// Gate 2 — a rupee amount is present.
const AMOUNT_RE = /(?:rs\.?|inr|₹)\s?[\d,]+(?:\.\d{1,2})?/i;

// Gate 3 — transactional vocabulary.
const TXN_RE = /debited|credited|spent|paid|received|withdrawn|txn|upi|a\/c|card ending|purchase|sent\s+rs/i;

// Gate 4 — NOT an OTP or a promo. This one is not optional: OTP messages come
// from the same sender IDs and contain amounts, so they sail through 1–3.
const EXCLUDE_RE = /\botp\b|one[- ]time password|do not share|never share|cashback upto|apply now|loan offer|emi offer|pre-?approved|click here|t&c apply|win\b|congratulations/i;

// Some banks omit the currency: "debited by 180.0".
const BARE_AMOUNT_RE = /\b(?:debited|credited|spent|paid|sent|withdrawn)\s+(?:by|for|with|of)?\s*[\d,]+(?:\.\d{1,2})?\b/i;

export type RawSms = { _id: string; address: string; body: string; date: number };

export type RejectReason = 'sender' | 'amount' | 'txn_words' | 'excluded' | null;

/**
 * Returns the reason a message was rejected, or null if it passes.
 * We keep the REASON (and the sender) for local debugging — never the body.
 */
export function rejectReason(sms: RawSms): RejectReason {
  const sender = (sms.address || '').trim();
  const body = sms.body || '';

  if (!SENDER_RE.test(sender)) return 'sender';
  if (EXCLUDE_RE.test(body)) return 'excluded';
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
