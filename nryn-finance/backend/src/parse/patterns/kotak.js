'use strict';
const { baseExtract, findMerchantRaw } = require('./common');

module.exports = {
  id: 'kotak',
  bank: 'Kotak Bank',
  tokens: ['KOTAKB','KOTAK'],
  match(body, ctx) {
    const base = baseExtract(body, ctx.receivedAt);
    if (base.amount === null || !base.direction) return null;
    const merchantRaw = findMerchantRaw(body);
    return {
      ...base,
      merchantRaw,
      bankName: 'Kotak Bank',
      accountType: /credit card|card ending|cc\b|avl lmt|available limit/i.test(body) ? 'credit_card' : 'savings',
      parserUsed: 'kotak.' + base.direction,
      confidence: merchantRaw ? 0.95 : 0.8,
    };
  },
};
