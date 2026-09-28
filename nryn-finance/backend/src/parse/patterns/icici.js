'use strict';
const { baseExtract, findMerchantRaw } = require('./common');

module.exports = {
  id: 'icici',
  bank: 'ICICI Bank',
  tokens: ['ICICIB', 'ICICIT', 'ICICI'],
  match(body, ctx) {
    const base = baseExtract(body, ctx.receivedAt);
    if (base.amount === null || !base.direction) return null;
    const merchantRaw = findMerchantRaw(body);
    return {
      ...base,
      merchantRaw,
      bankName: 'ICICI Bank',
      accountType: /credit card|card ending|cc\b|avl lmt|available limit/i.test(body) ? 'credit_card' : 'savings',
      parserUsed: 'icici.' + base.direction,
      confidence: merchantRaw ? 0.95 : 0.8,
    };
  },
};
