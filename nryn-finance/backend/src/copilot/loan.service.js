'use strict';

/**
 * Loan Prepayment & EMI Saver Simulator Engine
 */
function calculateLoanPrepayment({
  principalAmount = 3500000,
  annualInterestRate = 8.5,
  tenureMonths = 240,
  currentEmi = 0,
  extraMonthlyPrepayment = 2000,
  lumpSumPrepayment = 0
}) {
  const P = Number(principalAmount) || 3500000;
  const r = (Number(annualInterestRate) || 8.5) / 12 / 100;
  const n = Number(tenureMonths) || 240;
  const extraMonthly = Number(extraMonthlyPrepayment) || 0;
  const lumpSum = Number(lumpSumPrepayment) || 0;

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
    annualInterestRate,
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
      : 'Increase your monthly prepayment slightly to start shaving off years and interest.'
  };
}

module.exports = { calculateLoanPrepayment };
