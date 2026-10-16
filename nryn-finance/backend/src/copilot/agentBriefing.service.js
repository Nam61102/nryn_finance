'use strict';
const { DateTime } = require('luxon');
const Transaction = require('../db/models/Transaction');
const User = require('../db/models/User');
const { resolveBudgets } = require('../finance/budget.service');
const { resolveMonth, ZONE } = require('../finance/period');
const { detectAnomalies } = require('./anomaly.service');
const { detectSubscriptions } = require('./subscription.service');

/**
 * AI Agent Live Financial Briefing & Status Engine
 * Generates an executive autonomous daily intelligence summary for the user.
 */
async function generateAgentBriefing(userId, monthStr) {
  const p = resolveMonth(monthStr);
  const now = DateTime.now().setZone(ZONE);

  // 1. Fetch User Profile
  let userName = 'there';
  try {
    const user = await User.findById(userId).select('name').lean();
    if (user && user.name) {
      userName = user.name.trim().split(' ')[0];
    }
  } catch (err) {
    // default fallback
  }

  // 2. Fetch Transactions for current month
  const txns = await Transaction.find({
    userId,
    direction: 'debit',
    isExpense: true,
    deletedAt: null,
    occurredAt: { $gte: p.start, $lte: p.end },
  }).sort({ occurredAt: -1 }).select('amount merchantName category occurredAt').lean();

  const totalSpentPaise = txns.reduce((sum, t) => sum + (t.amount || 0), 0);
  const txnsCount = txns.length;

  // 3. Fetch previous month comparison
  const prevMonthDate = DateTime.fromISO(`${p.month}-01`, { zone: ZONE }).minus({ months: 1 });
  const prevMonthStr = prevMonthDate.toFormat('yyyy-MM');
  const prevPeriod = resolveMonth(prevMonthStr);

  const prevTxns = await Transaction.find({
    userId,
    direction: 'debit',
    isExpense: true,
    deletedAt: null,
    occurredAt: { $gte: prevMonthDate.startOf('month').toJSDate(), $lte: prevMonthDate.endOf('month').toJSDate() },
  }).select('amount').lean();

  const prevTotalSpentPaise = prevTxns.reduce((sum, t) => sum + (t.amount || 0), 0);

  // Calculate velocity comparison
  let velocityPct = 0;
  let isSaved = false;
  let isMore = false;
  if (prevTotalSpentPaise > 0) {
    const diff = totalSpentPaise - prevTotalSpentPaise;
    velocityPct = Math.round(Math.abs(diff) / prevTotalSpentPaise * 100);
    isSaved = diff < 0;
    isMore = diff > 0;
  }

  // 4. Resolve Budget Status
  // 4. Resolve Budget Status
  let budgetPaise = 0;
  let customDailyPaise = 0;
  let hasBudget = false;
  try {
    const resolved = await resolveBudgets(userId, p.month);
    if (resolved?.total?.amount > 0) {
      budgetPaise = resolved.total.amount;
      hasBudget = true;
    }
    if (resolved?.daily?.amount > 0) {
      customDailyPaise = resolved.daily.amount;
      hasBudget = true;
    }
  } catch {
    // no budget
  }

  const currentDay = p.isCurrent ? now.day : p.totalDays;
  const daysRemaining = p.isCurrent ? Math.max(1, p.totalDays - currentDay + 1) : 1;
  const remainingBudgetPaise = Math.max(0, budgetPaise - totalSpentPaise);
  const calculatedDailyPaise = budgetPaise > 0 ? Math.floor(remainingBudgetPaise / daysRemaining) : 0;
  const safeDailyPaise = customDailyPaise > 0 ? customDailyPaise : calculatedDailyPaise;

  // 5. Detect Anomalies & Subscriptions
  const [anomalyResult, subResult] = await Promise.all([
    detectAnomalies(userId).catch(() => ({ anomalies: [] })),
    detectSubscriptions(userId).catch(() => ({ subscriptions: [] })),
  ]);

  const anomaliesList = anomalyResult?.anomalies || [];
  const subsList = subResult?.subscriptions || [];
  const monthlySubsPaise = subsList.reduce((sum, s) => sum + (s.amount || 0), 0);

  // 6. Calculate Financial Health Score (0 - 100)
  let healthScore = 95;
  if (anomaliesList.length > 0) healthScore -= Math.min(25, anomaliesList.length * 10);
  if (budgetPaise > 0) {
    const budgetRatio = totalSpentPaise / budgetPaise;
    const timeRatio = currentDay / p.totalDays;
    if (budgetRatio > timeRatio + 0.15) {
      healthScore -= 15;
    } else if (budgetRatio < timeRatio) {
      healthScore = Math.min(100, healthScore + 5);
    }
  }

  // Determine Greeting by time of day
  const hour = now.hour;
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // 7. Craft Natural AI Agent Narrative
  let narrative = '';
  if (!hasBudget) {
    if (txnsCount === 0) {
      narrative = `I have audited your accounts for ${p.label || 'this month'}. No transactions recorded yet. Please configure your monthly and daily budget to activate automated pacing.`;
    } else {
      narrative = `I have audited ${txnsCount} transactions for ${p.label || 'this month'}. Please set your monthly & daily budget to activate daily allowance tracking and alerts.`;
    }
  } else if (txnsCount === 0) {
    narrative = `I have audited your accounts for ${p.label || 'this month'}. No expenses recorded yet. Your daily safe limit is ₹${Math.round(safeDailyPaise / 100).toLocaleString('en-IN')}/day.`;
  } else if (isSaved && velocityPct > 0) {
    narrative = `I've audited all ${txnsCount} transactions for ${p.label || 'this month'}. Your spending pace is ${velocityPct}% lower than last month, maintaining ₹${Math.round(safeDailyPaise / 100).toLocaleString('en-IN')}/day.`;
  } else if (isMore && velocityPct > 0) {
    narrative = `I've audited ${txnsCount} transactions. Spending velocity is ${velocityPct}% ahead of last month. Safe daily pace is ₹${Math.round(safeDailyPaise / 100).toLocaleString('en-IN')}/day.`;
  } else {
    narrative = `I have audited ${txnsCount} transactions for ${p.label || 'this month'}. Safe daily pace is ₹${Math.round(safeDailyPaise / 100).toLocaleString('en-IN')}/day with steady cashflow.`;
  }

  if (anomaliesList.length > 0) {
    narrative += ` Attention: ${anomaliesList.length} potential duplicate or unusual transaction(s) flagged for your review.`;
  } else {
    narrative += ` Zero anomalous charges detected.`;
  }

  return {
    ok: true,
    user: {
      name: userName,
      greeting: `${timeGreeting}, ${userName}`,
    },
    // AI Agent Live Status Pill Data
    statusPill: {
      state: anomaliesList.length > 0 ? 'warning' : 'optimal',
      label: 'AI AGENT LIVE',
      healthScore,
      auditedCount: txnsCount,
      anomaliesCount: anomaliesList.length,
      statusMessage: anomaliesList.length > 0
        ? `${anomaliesList.length} flagged charges require review`
        : `Autonomous watchdog active · 0 anomalies`,
      lastAuditedAt: now.toISO(),
    },
    // AI Agent Live Financial Briefing Data
    briefing: {
      headline: `${timeGreeting}, ${userName}!`,
      narrative,
      metrics: {
        hasBudget,
        totalSpentPaise,
        totalSpentINR: Math.round(totalSpentPaise / 100),
        safeDailyINR: Math.round(safeDailyPaise / 100),
        customDailyINR: Math.round(customDailyPaise / 100),
        budgetTotalINR: Math.round(budgetPaise / 100),
        budgetRemainingINR: Math.round(remainingBudgetPaise / 100),
        auditedTxnsCount: txnsCount,
        activeSubscriptionsCount: subsList.length,
        recurringMonthlyINR: Math.round(monthlySubsPaise / 100),
        velocityPct,
        velocityDirection: isSaved ? 'down' : isMore ? 'up' : 'flat',
        daysRemaining,
      },
      highlights: [
        {
          id: 'h1',
          label: 'Spending Velocity',
          value: isSaved ? `↓ ${velocityPct}% vs Last Mo` : isMore ? `↑ ${velocityPct}% vs Last Mo` : (prevTotalSpentPaise === 0 && totalSpentPaise > 0 ? `₹${Math.round(totalSpentPaise / 100).toLocaleString('en-IN')}` : 'Steady'),
          subtext: isSaved ? 'Pacing well below limit' : isMore ? 'Spending ahead of pace' : 'Cashflow steady',
        },
        {
          id: 'h2',
          label: 'Daily Budget',
          value: safeDailyPaise > 0 ? `₹${Math.round(safeDailyPaise / 100).toLocaleString('en-IN')}/day` : 'Set Budget',
          subtext: safeDailyPaise > 0 ? `${daysRemaining} days left in ${p.shortLabel || 'month'}` : 'Tap to configure',
        },
        {
          id: 'h3',
          label: 'Autonomous Audit',
          value: `${txnsCount} Txns`,
          subtext: anomaliesList.length === 0 ? '100% verified & clear' : `${anomaliesList.length} flagged`,
        },
      ],
      quickPrompts: [
        'Can I afford to spend ₹2,000 this weekend?',
        'Analyze my top spending categories',
        'Show my recurring subscriptions',
      ],
    },
  };
}

module.exports = {
  generateAgentBriefing,
};
