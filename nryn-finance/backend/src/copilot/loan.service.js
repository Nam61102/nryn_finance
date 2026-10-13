'use strict';

/**
 * Loan Prepayment & EMI Saver Simulator Engine
 */
function calculateLoanPrepayment({
  principalAmount,
  annualInterestRate,
  tenureMonths,
  currentEmi = 0,
  extraMonthlyPrepayment = 0,
  lumpSumPrepayment = 0,
}) {
  const P = Number(principalAmount);
  const annualRate = Number(annualInterestRate);
  const n = Number(tenureMonths);

  if (!P || P <= 0 || isNaN(P)) {
    const err = new Error('Valid positive principalAmount is required');
    err.status = 400;
    err.code = 'INVALID_PRINCIPAL';
    throw err;
  }
  if (!annualRate || annualRate <= 0 || isNaN(annualRate)) {
    const err = new Error('Valid positive annualInterestRate is required');
    err.status = 400;
    err.code = 'INVALID_INTEREST_RATE';
    throw err;
  }
  if (!n || n <= 0 || isNaN(n)) {
    const err = new Error('Valid positive tenureMonths is required');
    err.status = 400;
    err.code = 'INVALID_TENURE';
    throw err;
  }

  const r = annualRate / 12 / 100;
  const extraMonthly = Math.max(0, Number(extraMonthlyPrepayment) || 0);
  const lumpSum = Math.max(0, Number(lumpSumPrepayment) || 0);

  // Compute baseline EMI if not provided
  let baselineEmi = Number(currentEmi);
  if (!baselineEmi || baselineEmi <= 0) {
    baselineEmi = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
  }

  // 1. Baseline Amortization
  let balanceBase = P;
  let totalInterestBase = 0;
  for (let m = 1; m <= n; m++) {
    const interest = balanceBase * r;
    totalInterestBase += interest;
    const principalPaid = baselineEmi - interest;
    balanceBase -= principalPaid;
    if (balanceBase <= 0) break;
  }

  // 2. Prepayment Amortization
  let balanceNew = Math.max(0, P - lumpSum);
  let totalInterestNew = 0;
  let newTenureMonths = 0;

  const totalMonthlyPayment = baselineEmi + extraMonthly;

  for (let m = 1; m <= n * 2; m++) {
    const interest = balanceNew * r;
    totalInterestNew += interest;
    const principalPaid = totalMonthlyPayment - interest;
    balanceNew -= principalPaid;
    newTenureMonths = m;
    if (balanceNew <= 0) break;
  }

  const totalInterestSaved = Math.max(0, Math.round(totalInterestBase - totalInterestNew));
  const monthsSaved = Math.max(0, n - newTenureMonths);
  const yearsSaved = Number((monthsSaved / 12).toFixed(1));

  return {
    ok: true,
    principalINR: P,
    annualInterestRate: annualRate,
    originalTenureMonths: n,
    baselineEmiINR: baselineEmi,
    extraMonthlyPrepaymentINR: extraMonthly,
    lumpSumPrepaymentINR: lumpSum,
    originalTotalInterestINR: Math.round(totalInterestBase),
    newTotalInterestINR: Math.round(totalInterestNew),
    totalInterestSavedINR: totalInterestSaved,
    originalTotalPaymentINR: Math.round(P + totalInterestBase),
    newTotalPaymentINR: Math.round(P + totalInterestNew),
    newTenureMonths,
    monthsSaved,
    yearsSaved,
    recommendation: monthsSaved > 0
      ? `Paying just ₹${extraMonthly.toLocaleString('en-IN')} extra per month saves ₹${totalInterestSaved.toLocaleString('en-IN')} in interest and closes your loan ${yearsSaved} years (${monthsSaved} months) early!`
      : 'Enter an extra monthly prepayment or lump sum to see interest and time savings.',
  };
}

module.exports = { calculateLoanPrepayment };
