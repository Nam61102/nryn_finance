'use strict';
const Policy = require('../db/models/Policy');
const Transaction = require('../db/models/Transaction');
const User = require('../db/models/User');
const { resolveFinancialYear } = require('../finance/period');

/**
 * 80C & 80D Tax-Saving Discovery Radar Engine (Indian Financial Year, IST)
 */
async function calculateTaxRadar(userId, options = {}) {
  const user = await User.findById(userId).select('taxRegime').lean().catch(() => null);
  const regime = options.taxRegime || user?.taxRegime || null;
  const fy = resolveFinancialYear();

  // If tax regime is unknown, ask user to choose
  if (!regime) {
    return {
      ok: true,
      regimeUnknown: true,
      taxRegime: null,
      financialYear: fy.financialYear,
      financialYearLabel: fy.label,
      message: 'Select your tax regime (New Regime or Old Regime) to see applicable deductions.',
      section80C: {
        limitPaise: 15000000,
        limitINR: 150000,
        utilizedPaise: 0,
        utilizedINR: 0,
        remainingPaise: 15000000,
        remainingINR: 150000,
        percentage: 0,
        notApplicable: false,
        items: [],
      },
      section80D: {
        limitPaise: 2500000,
        limitINR: 25000,
        utilizedPaise: 0,
        utilizedINR: 0,
        remainingPaise: 2500000,
        remainingINR: 25000,
        percentage: 0,
        notApplicable: false,
        items: [],
      },
      totalDeductionClaimedINR: 0,
      potentialTaxSavingsINR: null,
      empty: true,
      actionableTip: 'Under the default New Tax Regime, 80C and 80D deductions do not apply. Switch to the Old Regime if you plan to claim them.',
    };
  }

  // If tax regime is New, 80C/80D deductions are not applicable
  if (regime === 'new') {
    return {
      ok: true,
      regimeUnknown: false,
      taxRegime: 'new',
      notApplicable: true,
      financialYear: fy.financialYear,
      financialYearLabel: fy.label,
      message: 'Section 80C and 80D deductions do not apply under the New Tax Regime (default since FY 2023-24). Standard deduction and lower tax slab rates apply instead.',
      section80C: {
        limitPaise: 0,
        limitINR: 0,
        utilizedPaise: 0,
        utilizedINR: 0,
        remainingPaise: 0,
        remainingINR: 0,
        percentage: 0,
        notApplicable: true,
        items: [],
      },
      section80D: {
        limitPaise: 0,
        limitINR: 0,
        utilizedPaise: 0,
        utilizedINR: 0,
        remainingPaise: 0,
        remainingINR: 0,
        percentage: 0,
        notApplicable: true,
        items: [],
      },
      totalDeductionClaimedINR: 0,
      potentialTaxSavingsINR: null,
      empty: true,
      actionableTip: 'Under the New Tax Regime, tax slabs are lower, but exemptions under 80C and 80D cannot be claimed.',
    };
  }

  // Old Regime: compute from REAL policies and REAL investment transactions only
  const [policies, investmentTxns] = await Promise.all([
    Policy.find({ userId }).lean().catch(() => []),
    Transaction.find({
      userId,
      category: 'investment',
      direction: 'debit',
      deletedAt: null,
      occurredAt: { $gte: fy.start, $lte: fy.end },
    }).lean().catch(() => []),
  ]);

  const items80C = [];
  const items80D = [];
  let total80CPaise = 0;
  let total80DPaise = 0;

  // Real insurance policies
  policies.forEach((p) => {
    const annualPrem = p.premiumAmount || 0;
    if (annualPrem <= 0) return;

    if (p.type === 'life' || p.type === 'term') {
      total80CPaise += annualPrem;
      items80C.push({
        title: p.title || 'Life Insurance Premium',
        provider: p.provider,
        amountPaise: annualPrem,
        amountINR: Math.round(annualPrem / 100),
        section: '80C',
      });
    } else if (p.type === 'health' || p.type === 'medical') {
      total80DPaise += annualPrem;
      items80D.push({
        title: p.title || 'Health Insurance Mediclaim',
        provider: p.provider,
        amountPaise: annualPrem,
        amountINR: Math.round(annualPrem / 100),
        section: '80D',
      });
    }
  });

  // Real investment transactions (ELSS, Mutual Funds, PPF)
  investmentTxns.forEach((t) => {
    total80CPaise += t.amount;
    items80C.push({
      title: t.merchantName || 'ELSS / Mutual Fund Tax Saver',
      provider: 'Investment / Mutual Fund',
      amountPaise: t.amount,
      amountINR: Math.round(t.amount / 100),
      section: '80C',
    });
  });

  // Statutory limits for Old Regime
  const limit80CPaise = 150000 * 100; // ₹1,50,000
  const limit80DPaise = 25000 * 100;  // ₹25,000

  const utilized80CPaise = Math.min(limit80CPaise, total80CPaise);
  const remaining80CPaise = Math.max(0, limit80CPaise - total80CPaise);
  const pct80C = Number(((utilized80CPaise / limit80CPaise) * 100).toFixed(1));

  const utilized80DPaise = Math.min(limit80DPaise, total80DPaise);
  const remaining80DPaise = Math.max(0, limit80DPaise - total80DPaise);
  const pct80D = Number(((utilized80DPaise / limit80DPaise) * 100).toFixed(1));

  const isEmpty = items80C.length === 0 && items80D.length === 0;

  // Do not hardcode a 20.8% slab tax saved figure unless slab is explicitly passed
  let potentialTaxSavingsINR = null;
  if (options.taxSlabRate && typeof options.taxSlabRate === 'number') {
    const totalRemainingDeductionINR = (remaining80CPaise + remaining80DPaise) / 100;
    potentialTaxSavingsINR = Math.round(totalRemainingDeductionINR * options.taxSlabRate);
  }

  let actionableTip = '';
  if (isEmpty) {
    actionableTip = `No tax-saving investments or policies found for ${fy.label}. Add your ELSS, PPF, or life/health policies to track deductions.`;
  } else if (remaining80CPaise > 0) {
    actionableTip = `You have ₹${Math.round(remaining80CPaise / 100).toLocaleString('en-IN')} remaining under Section 80C to invest before March 31.`;
  } else {
    actionableTip = `You have maximized your Section 80C deduction limit for ${fy.label}.`;
  }

  return {
    ok: true,
    regimeUnknown: false,
    taxRegime: 'old',
    financialYear: fy.financialYear,
    financialYearLabel: fy.label,
    empty: isEmpty,
    section80C: {
      limitPaise: limit80CPaise,
      limitINR: Math.round(limit80CPaise / 100),
      utilizedPaise: utilized80CPaise,
      utilizedINR: Math.round(utilized80CPaise / 100),
      remainingPaise: remaining80CPaise,
      remainingINR: Math.round(remaining80CPaise / 100),
      percentage: pct80C,
      notApplicable: false,
      items: items80C,
    },
    section80D: {
      limitPaise: limit80DPaise,
      limitINR: Math.round(limit80DPaise / 100),
      utilizedPaise: utilized80DPaise,
      utilizedINR: Math.round(utilized80DPaise / 100),
      remainingPaise: remaining80DPaise,
      remainingINR: Math.round(remaining80DPaise / 100),
      percentage: pct80D,
      notApplicable: false,
      items: items80D,
    },
    totalDeductionClaimedINR: Math.round((utilized80CPaise + utilized80DPaise) / 100),
    potentialTaxSavingsINR,
    actionableTip,
  };
}

module.exports = { calculateTaxRadar };
