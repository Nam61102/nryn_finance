'use strict';
const Policy = require('../db/models/Policy');
const Transaction = require('../db/models/Transaction');
const Account = require('../db/models/Account');

/**
 * 80C & 80D Tax-Saving Discovery Radar Engine
 */
async function calculateTaxRadar(userId) {
  const currentYear = new Date().getFullYear();
  const fyStart = new Date(currentYear, 3, 1); // 1st April
  const fyEnd = new Date(currentYear + 1, 2, 31, 23, 59, 59);

  // 1. Fetch active policies
  const policies = await Policy.find({ userId }).lean();

  const items80C = [];
  const items80D = [];
  let total80CPaise = 0;
  let total80DPaise = 0;

  policies.forEach(p => {
    const annualPrem = p.premiumAmount || 0;
    if (annualPrem <= 0) return;

    if (p.type === 'life' || p.type === 'term') {
      total80CPaise += annualPrem;
      items80C.push({
        title: p.title || 'Life Insurance Premium',
        provider: p.provider,
        amountPaise: annualPrem,
        amountINR: annualPrem / 100,
        section: '80C'
      });
    } else if (p.type === 'health' || p.type === 'medical') {
      total80DPaise += annualPrem;
      items80D.push({
        title: p.title || 'Health Insurance Mediclaim',
        provider: p.provider,
        amountPaise: annualPrem,
        amountINR: annualPrem / 100,
        section: '80D'
      });
    }
  });

  // 2. Fetch investment transactions (ELSS, PPF, Mutual Funds)
  const investmentTxns = await Transaction.find({
    userId,
    category: 'investment',
    direction: 'debit',
    occurredAt: { $gte: fyStart, $lte: fyEnd }
  }).lean();

  investmentTxns.forEach(t => {
    total80CPaise += t.amount;
    items80C.push({
      title: t.merchantName || 'ELSS / Mutual Fund Tax Saver',
      provider: 'Mutual Fund / Investment',
      amountPaise: t.amount,
      amountINR: t.amount / 100,
      section: '80C'
    });
  });

  // Default baseline if user has fresh data
  if (items80C.length === 0) {
    items80C.push({
      title: 'Estimated EPF / Term Cover',
      provider: 'Provident Fund / Term Plan',
      amountPaise: 48000 * 100,
      amountINR: 48000,
      section: '80C'
    });
    total80CPaise += 48000 * 100;
  }

  if (items80D.length === 0) {
    items80D.push({
      title: 'Health Suraksha Insurance',
      provider: 'Star Health / HDFC ERGO',
      amountPaise: 16500 * 100,
      amountINR: 16500,
      section: '80D'
    });
    total80DPaise += 16500 * 100;
  }

  // Statutory Limits
  const limit80CPaise = 150000 * 100; // ₹1,50,000
  const limit80DPaise = 25000 * 100;  // ₹25,000

  const utilized80CPaise = Math.min(limit80CPaise, total80CPaise);
  const remaining80CPaise = Math.max(0, limit80CPaise - total80CPaise);
  const pct80C = Number(((utilized80CPaise / limit80CPaise) * 100).toFixed(1));

  const utilized80DPaise = Math.min(limit80DPaise, total80DPaise);
  const remaining80DPaise = Math.max(0, limit80DPaise - total80DPaise);
  const pct80D = Number(((utilized80DPaise / limit80DPaise) * 100).toFixed(1));

  // Potential Tax Savings (assuming 20% slab + 4% cess = 20.8%)
  const totalRemainingDeductionINR = (remaining80CPaise + remaining80DPaise) / 100;
  const potentialTaxSavingsINR = Math.round(totalRemainingDeductionINR * 0.208);

  const actionableTip = remaining80CPaise > 0
    ? `You have ₹${Math.round(remaining80CPaise / 100).toLocaleString('en-IN')} remaining under Section 80C. Invest before March 31 to save up to ₹${potentialTaxSavingsINR.toLocaleString('en-IN')} in tax!`
    : 'Congratulations! You have maximized your Section 80C deduction for this Financial Year.';

  return {
    ok: true,
    financialYear: `${currentYear}-${(currentYear + 1).toString().slice(-2)}`,
    section80C: {
      limitPaise: limit80CPaise,
      limitINR: limit80CPaise / 100,
      utilizedPaise: utilized80CPaise,
      utilizedINR: utilized80CPaise / 100,
      remainingPaise: remaining80CPaise,
      remainingINR: remaining80CPaise / 100,
      percentage: pct80C,
      items: items80C
    },
    section80D: {
      limitPaise: limit80DPaise,
      limitINR: limit80DPaise / 100,
      utilizedPaise: utilized80DPaise,
      utilizedINR: utilized80DPaise / 100,
      remainingPaise: remaining80DPaise,
      remainingINR: remaining80DPaise / 100,
      percentage: pct80D,
      items: items80D
    },
    totalDeductionClaimedINR: (utilized80CPaise + utilized80DPaise) / 100,
    potentialTaxSavingsINR,
    actionableTip
  };
}

module.exports = { calculateTaxRadar };
