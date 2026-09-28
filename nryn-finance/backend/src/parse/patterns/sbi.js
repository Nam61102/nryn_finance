'use strict';
const { baseExtract, findMerchantRaw } = require('./common');

module.exports = {
  id: 'sbi',
  bank: 'SBI',
  tokens: ['SBI', 'SBIINB', 'SBIUPI', 'ATMSBI', 'SBICRD', 'SBIPSG', 'CBSSBI'],
  match(body, ctx) {
    const base = baseExtract(body, ctx.receivedAt);
    if (base.amount === null || !base.direction) return null;
    const merchantRaw = findMerchantRaw(body);
    return {
      ...base,
      merchantRaw,
      bankName: 'SBI',
      accountType: /credit card|card ending|cc\b|avl lmt|available limit/i.test(body) ? 'credit_card' : 'savings',
      parserUsed: 'sbi.' + base.direction,
      confidence: merchantRaw ? 0.95 : 0.8,
    };
  },
};
