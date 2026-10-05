'use strict';
const Transaction = require('../db/models/Transaction');
const Account = require('../db/models/Account');
const Budget = require('../db/models/Budget');

/**
 * Safe-to-Spend & Daily Burn Rate Intelligence Engine
 */
async function calculateSafeSpend(userId, monthStr) {
  const now = new Date();
  let targetYear, targetMonth;

  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const parts = monthStr.split('-');
    targetYear = parseInt(parts[0], 10);
    targetMonth = parseInt(parts[1], 10) - 1;
  } else {
    targetYear = now.getFullYear();
    targetMonth = now.getMonth();
  }

  const startOfMonth = new Date(Date.UTC(targetYear, targetMonth, 1));
  const endOfMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));
  const daysInMonth = endOfMonth.getUTCDate();

  // If calculating for current month, calculate remaining days from today
  const isCurrentMonth = (targetYear === now.getFullYear() && targetMonth === now.getMonth());
  const currentDay = isCurrentMonth ? now.getDate() : daysInMonth;
  const daysRemaining = isCurrentMonth ? Math.max(1, daysInMonth - currentDay + 1) : 1;

  // 1. Fetch total monthly budget (default to ₹35,000 if not set)
  let budgetPaise = 35000 * 100;
  try {
    const b = await Budget.findOne({ userId, scope: 'total', month: { $in: [monthStr, null] } }).lean();
    if (b && b.amount > 0) budgetPaise = b.amount;
  } catch (err) {
    // fallback
  }

  // 2. Fetch Fixed monthly liabilities (EMIs from loan accounts)
  let fixedLiabilitiesPaise = 0;
  try {
    const loanAccounts = await Account.find({ userId, type: 'loan' }).select('emiAmount').lean();
    fixedLiabilitiesPaise = loanAccounts.reduce((acc, a) => acc + (a.emiAmount || 0), 0);
  } catch (err) {
    // fallback
  }

  // 3. Fetch all expenses occurred so far this month
  const txns = await Transaction.find({
    userId,
    direction: 'debit',
    isExpense: true,
    occurredAt: { $gte: startOfMonth, $lte: endOfMonth }
  }).select('amount occurredAt').lean();

  const totalSpentSoFarPaise = txns.reduce((sum, t) => sum + (t.amount || 0), 0);

  // 4. Calculate today's spending
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const todayTxns = txns.filter(t => {
    const d = new Date(t.occurredAt);
    return d >= startOfToday && d <= endOfToday;
  });
  const todaySpentPaise = todayTxns.reduce((sum, t) => sum + (t.amount || 0), 0);

  // 5. Compute available pool
  const discretionaryPoolPaise = Math.max(0, budgetPaise - fixedLiabilitiesPaise - totalSpentSoFarPaise);
  const dailySafeSpendPaise = Math.max(0, Math.round(discretionaryPoolPaise / daysRemaining));
  const todayRemainingPaise = Math.max(0, dailySafeSpendPaise - todaySpentPaise);

  // 6. Burn status & Projected Runout Date
  let burnStatus = 'green';
  if (todaySpentPaise > dailySafeSpendPaise * 1.3) burnStatus = 'red';
  else if (todaySpentPaise > dailySafeSpendPaise) burnStatus = 'amber';

  const daysSpent = Math.max(1, currentDay);
  const avgDailyBurnPaise = Math.round(totalSpentSoFarPaise / daysSpent);
  let projectedRunoutDate = null;

  if (avgDailyBurnPaise > 0) {
    const remainingDaysCapacity = Math.floor((budgetPaise - fixedLiabilitiesPaise - totalSpentSoFarPaise) / avgDailyBurnPaise);
    const runoutDay = Math.min(daysInMonth, currentDay + Math.max(0, remainingDaysCapacity));
    projectedRunoutDate = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(runoutDay).padStart(2, '0')}`;
  }

  let insightMessage = `Safe to spend ₹${Math.round(dailySafeSpendPaise / 100)} today without breaking month-end budget.`;
  if (burnStatus === 'green') {
    insightMessage = `You're in the green zone! Spent ₹${Math.round(todaySpentPaise / 100)} of your ₹${Math.round(dailySafeSpendPaise / 100)} daily limit today.`;
  } else if (burnStatus === 'amber') {
    insightMessage = `Caution: Today's spending has reached ₹${Math.round(todaySpentPaise / 100)}. Keep evening spend minimal to stay on track.`;
  } else {
    insightMessage = `Alert: Today's limit exceeded by ₹${Math.round((todaySpentPaise - dailySafeSpendPaise) / 100)}. Daily budget adjusted for the remaining ${daysRemaining} days.`;
  }

  return {
    ok: true,
    month: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`,
    currentDay,
    daysInMonth,
    daysRemaining,
    totalBudgetPaise: budgetPaise,
    fixedLiabilitiesPaise,
    totalSpentSoFarPaise,
    discretionaryPoolPaise,
    dailySafeSpendPaise,
    dailySafeSpendINR: Math.round(dailySafeSpendPaise / 100),
    todaySpentPaise,
    todaySpentINR: Math.round(todaySpentPaise / 100),
    todayRemainingPaise,
    todayRemainingINR: Math.round(todayRemainingPaise / 100),
    avgDailyBurnPaise,
    burnStatus,
    projectedRunoutDate,
    insightMessage
  };
}

module.exports = { calculateSafeSpend };
