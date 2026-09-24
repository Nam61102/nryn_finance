'use strict';
const { baseExtract, findMerchantRaw } = require('./common');
const { bankFor } = require('../senders');

/**
 * The catch-all. Covers every bank we have not written a dedicated module for,
 * plus GPay / PhonePe / Paytm / BHIM wording. Slightly lower confidence, so a
 * bank-specific module always wins when both match.
 */
module.exports = {
  id: 'upi-generic',
  bank: null,
  tokens: null,                       // matches any sender
  match(body, ctx) {
    const base = baseExtract(body, ctx.receivedAt);
    if (base.amount === null || !base.direction) return null;
    const merchantRaw = findMerchantRaw(body);
    return {
      ...base,
      merchantRaw,
      bankName: bankFor(ctx.sender) || null,
      accountType: /credit card|card ending|avl lmt|available limit/i.test(body) ? 'credit_card' : 'savings',
      parserUsed: 'upi-generic.' + base.direction,
      confidence: merchantRaw ? 0.75 : 0.6,
    };
  },
};
