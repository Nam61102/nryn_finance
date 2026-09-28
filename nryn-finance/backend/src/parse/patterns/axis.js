'use strict';
const { baseExtract, findMerchantRaw } = require('./common');

module.exports = {
  id: 'axis',
  bank: 'Axis Bank',
  tokens: ['AXISBK', 'AXISBN', 'AXIS'],
  match(body, ctx) {
    const base = baseExtract(body, ctx.receivedAt);
    if (base.amount === null || !base.direction) return null;
    const merchantRaw = findMerchantRaw(body);
    return {
      ...base,
      merchantRaw,
      bankName: 'Axis Bank',
      accountType: /credit card|card ending|cc\b|avl lmt|available limit/i.test(body) ? 'credit_card' : 'savings',
      parserUsed: 'axis.' + base.direction,
      confidence: merchantRaw ? 0.95 : 0.8,
    };
  },
};
