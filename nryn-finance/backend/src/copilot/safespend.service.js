'use strict';
const { DateTime } = require('luxon');
const Transaction = require('../db/models/Transaction');
const Account = require('../db/models/Account');
const { resolveBudgets } = require('../finance/budget.service');
const { resolveMonth, startOfToday, endOfDay, ZONE } = require('../finance/period');

/**
 * Safe-to-Spend & Daily Burn Rate Intelligence Engine (IST)
 */
async function calculateSafeSpend(userId, monthStr) {
  const p = resolveMonth(monthStr);
  const now = DateTime.now().setZone(ZONE);

  const currentDay = p.isCurrent ? now.day : p.totalDays;
  const daysRemaining = p.isCurrent ? Math.max(1, p.totalDays - currentDay + 1) : 1;

  // 1. Fetch total monthly budget using canonical budget.service resolution
  let budgetPaise = 0;
  let hasBudget = false;
  try {
    const resolved = await resolveBudgets(userId, p.month);
    if (resolved?.total?.amount > 0) {
      budgetPaise = resolved.total.amount;
      hasBudget = true;
    }
  } catch {
    // no budget set
  }

  // 2. Fetch Fixed monthly liabilities (EMIs from loan accounts)
  let fixedLiabilitiesPaise = 0;
  try {
    const loanAccounts = await Account.find({ userId, type: 'loan' }).select('emiAmount').lean();
    fixedLiabilitiesPaise = loanAccounts.reduce((acc, a) => acc + (a.emiAmount || 0), 0);
  } catch {
    // no loans
  }

  // 3. Fetch all expenses occurred so far this month (IST boundaries, soft deletes excluded)
  const txns = await Transaction.find({
    userId,
    direction: 'debit',
    isExpense: true,
    deletedAt: null,
    occurredAt: { $gte: p.start, $lte: p.end },
  }).select('amount occurredAt').lean();

  const totalSpentSoFarPaise = txns.reduce((sum, t) => sum + (t.amount || 0), 0);

  // 4. Calculate today's spending in IST
  const todayStart = startOfToday();
  const todayEnd = endOfDay();

  const todayTxns = p.isCurrent
    ? txns.filter((t) => {
        const d = new Date(t.occurredAt);
        return d >= todayStart && d <= todayEnd;
      })
    : [];
  const todaySpentPaise = todayTxns.reduce((sum, t) => sum + (t.amount || 0), 0);

  // 5. Compute available pool based on actual budget
  const discretionaryPoolPaise = hasBudget ? Math.max(0, budgetPaise - fixedLiabilitiesPaise - totalSpentSoFarPaise) : 0;
  const dailySafeSpendPaise = hasBudget ? Math.max(0, Math.round(discretionaryPoolPaise / daysRemaining)) : 0;
  const todayRemainingPaise = hasBudget ? Math.max(0, dailySafeSpendPaise - todaySpentPaise) : 0;

  // 6. Burn status & Projected Runout Date
  let burnStatus = 'green';
  if (!hasBudget) {
    burnStatus = 'no_budget';
  } else if (todaySpentPaise > dailySafeSpendPaise * 1.3) {
    burnStatus = 'red';
  } else if (todaySpentPaise > dailySafeSpendPaise) {
    burnStatus = 'amber';
  }

  const daysSpent = Math.max(1, currentDay);
  const avgDailyBurnPaise = Math.round(totalSpentSoFarPaise / daysSpent);
  let projectedRunoutDate = null;

  if (hasBudget && avgDailyBurnPaise > 0) {
    const remainingDaysCapacity = Math.floor((budgetPaise - fixedLiabilitiesPaise - totalSpentSoFarPaise) / avgDailyBurnPaise);
    const runoutDay = Math.min(p.totalDays, currentDay + Math.max(0, remainingDaysCapacity));
    projectedRunoutDate = now.set({ day: runoutDay }).toFormat('yyyy-MM-dd');
  }

  let insightMessage = '';
  const spentTodayINR = Math.round(todaySpentPaise / 100);
  if (!hasBudget) {
    insightMessage = spentTodayINR > 0
      ? `Spent ₹${spentTodayINR.toLocaleString('en-IN')} today. Set a budget in the Budgets tab to unlock your daily safe limit.`
      : 'Set a budget in the Budgets tab to unlock your safe spending limit.';
  } else if (burnStatus === 'green') {
    insightMessage = `You're in the green zone! Spent ₹${spentTodayINR.toLocaleString('en-IN')} of your ₹${Math.round(dailySafeSpendPaise / 100).toLocaleString('en-IN')} daily limit today.`;
  } else if (burnStatus === 'amber') {
    insightMessage = `Caution: Today's spending has reached ₹${spentTodayINR.toLocaleString('en-IN')}. Keep remaining spend minimal to stay on track.`;
  } else {
    const excessINR = Math.round((todaySpentPaise - dailySafeSpendPaise) / 100);
    insightMessage = `Alert: Today's limit exceeded by ₹${excessINR.toLocaleString('en-IN')}. Daily budget adjusted for remaining ${daysRemaining} days.`;
  }

  return {
    ok: true,
    hasBudget,
    month: p.month,
    currentDay,
    daysInMonth: p.totalDays,
    daysRemaining,
    totalBudgetPaise: budgetPaise,
    totalBudgetINR: Math.round(budgetPaise / 100),
    fixedLiabilitiesPaise,
    totalSpentSoFarPaise,
    totalSpentSoFarINR: Math.round(totalSpentSoFarPaise / 100),
    discretionaryPoolPaise,
    dailySafeSpendPaise,
    dailySafeSpendINR: Math.round(dailySafeSpendPaise / 100),
    todaySpentPaise,
    todaySpentINR: spentTodayINR,
    todayRemainingPaise,
    todayRemainingINR: Math.round(todayRemainingPaise / 100),
    avgDailyBurnPaise,
    avgDailyBurnINR: Math.round(avgDailyBurnPaise / 100),
    burnStatus,
    projectedRunoutDate,
    insightMessage,
  };
}

module.exports = { calculateSafeSpend };
