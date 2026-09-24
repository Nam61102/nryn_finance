'use strict';
const N = require('../normalize');

/** Fields every Indian bank SMS shares. Bank modules add merchant + confidence. */
function baseExtract(body, receivedAt) {
  const amount = N.extractAmount(body);
  const direction = N.detectDirection(body);
  const balMatch = body.match(/(?:avl(?:\.|able)?\s*(?:bal|balance|lmt|limit)|bal(?:ance)?)\s*[:is]*\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  return {
    amount,
    direction,
    occurredAt: N.extractOccurredAt(body, receivedAt),
    last4: N.extractLast4(body),
    refId: N.extractRefId(body),
    method: N.detectMethod(body),
    balanceAfter: balMatch ? N.toPaise(balMatch[1]) : null,
  };
}

/**
 * Merchant phrase hunters, most specific first. Each returns the raw merchant
 * string as the bank wrote it — cleaning happens in normalize.cleanMerchant.
 */
const MERCHANT_RULES = [
  /\bto\s+vpa\s+([^\s.,;]+)/i,
  /\btrf\s+to\s+([A-Za-z0-9&.' -]{2,40}?)(?=\s+(?:ref|refno|upi|on|\.|,|$))/i,
  /\b(?:to|towards)\s+([A-Za-z0-9&.' -]{2,40}?)(?=\s+(?:on|ref|refno|upi|txn|\.|,|$))/i,
  /\bat\s+([A-Za-z0-9&.' -]{2,40}?)(?=\s+(?:on|ref|txn|\.|,|$))/i,
  /\bfrom\s+([A-Za-z0-9&.' -]{2,40}?)(?=\s+(?:on|ref|txn|\.|,|$))/i,
  /\binfo[:\s]+(?:upi\/)?(?:[A-Z]+\/)?([A-Za-z0-9&.' -]{2,40}?)(?=[\s.,;]|$)/i,
  /\bVPA\s+([^\s.,;]+)/i,
  /;\s*([A-Za-z0-9&.' ]{3,40}?)\s+credited/i,
];

function findMerchantRaw(body) {
  for (const re of MERCHANT_RULES) {
    const m = body.match(re);
    if (m && m[1] && m[1].trim().length >= 2) return m[1].trim();
  }
  return null;
}

module.exports = { baseExtract, findMerchantRaw };
