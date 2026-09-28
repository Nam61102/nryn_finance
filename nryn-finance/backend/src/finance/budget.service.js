'use strict';
const Budget = require('../db/models/Budget');
const Alert = require('../db/models/Alert');
const { BY_KEY } = require('../shared/categories');
const { resolveMonth } = require('./period');
const { monthSummary, byCategory } = require('./analytics.service');

/**
 * Resolution: a month-specific row overrides the rolling default (§7A).
 * Without this you either re-enter budgets every month, or can't change one
 * month without rewriting history.
 */
async function resolveBudgets(userId, month) {
  const rows = await Budget.find({ userId, $or: [{ month }, { month: null }] }).lean();
  const pick = (scope, category = null) =>
    rows.find((r) => r.scope === scope && r.category === category && r.month === month) ||
    rows.find((r) => r.scope === scope && r.category === category && r.month === null) ||
    null;

  const total = pick('total');
  const categories = {};
  for (const r of rows) {
    if (r.scope !== 'category' || !r.category) continue;
    if (!categories[r.category] || r.month === month) categories[r.category] = pick('category', r.category);
  }
  return { total, categories };
}

function paceFor(spent, budget, elapsedDays, totalDays) {
  if (!budget || budget <= 0 || !elapsedDays) return { pace: null, state: 'no_budget', copy: 'Set a monthly budget to track your pace' };
  const expected = budget * (elapsedDays / totalDays);
  const pace = expected > 0 ? spent / expected : 0;
  if (spent > budget) return { pace, state: 'over', copy: 'Over budget — ease off for the rest of the month' };
  if (pace < 0.9) return { pace, state: 'good', copy: 'Cashflow looks good! You’re managing it well, stay consistent' };
  if (pace <= 1.0) return { pace, state: 'on_track', copy: 'On track — right about where you should be' };
  return { pace, state: 'ahead', copy: 'Spending faster than planned this month' };
}

/** Ring + every chip + the pace copy, in ONE call. The home screen must never
 *  make two requests to render one card. */
async function status(userId, monthStr) {
  const p = resolveMonth(monthStr);
  const [summary, cats, budgets, prevSummary] = await Promise.all([
    monthSummary(userId, p.month),
    byCategory(userId, p.month),
    resolveBudgets(userId, p.month),
    monthSummary(userId, p.prev),
  ]);

  const totalBudget = budgets.total?.amount || 0;
  const spent = summary.spent;
  const remaining = totalBudget - spent;          // TRUE value, may be negative
  const spentByCat = Object.fromEntries(cats.categories.map((c) => [c.category, c.spent]));

  const prevP = resolveMonth(p.prev);
  const lastMonthSpent = prevSummary?.spent || 0;
  const diff = spent - lastMonthSpent;
  const isSaved = lastMonthSpent > spent;
  const isMore = spent > lastMonthSpent;
  const savedAmount = isSaved ? lastMonthSpent - spent : 0;
  const moreAmount = isMore ? spent - lastMonthSpent : 0;
  const percentChange = lastMonthSpent > 0 ? Math.round((Math.abs(diff) / lastMonthSpent) * 100) : null;

  let comparisonText = '';
  if (lastMonthSpent === 0 && spent === 0) {
    comparisonText = 'No expenses recorded';
  } else if (lastMonthSpent === 0) {
    comparisonText = 'First tracked month';
  } else if (isSaved) {
    comparisonText = `Saved ₹${(savedAmount / 100).toLocaleString('en-IN')}${percentChange !== null ? ` (${percentChange}%)` : ''} compared to ${prevP.shortLabel}`;
  } else if (isMore) {
    comparisonText = `Spent ₹${(moreAmount / 100).toLocaleString('en-IN')}${percentChange !== null ? ` (${percentChange}%)` : ''} more than ${prevP.shortLabel}`;
  } else {
    comparisonText = `Same spend as ${prevP.shortLabel}`;
  }

  const comparison = {
    currentSpent: spent,
    lastMonthSpent,
    diff,
    isSaved,
    isMore,
    savedAmount,
    moreAmount,
    percentChange,
    prevMonth: prevP.month,
    prevLabel: prevP.shortLabel,
    prevFullLabel: prevP.label,
    comparisonText,
  };

  const chips = Object.entries(budgets.categories)
    .filter(([, b]) => b && b.amount > 0)
    .map(([category, b]) => {
      const catSpent = spentByCat[category] || 0;
      return {
        category,
        label: BY_KEY[category]?.label || category,
        icon: BY_KEY[category]?.icon,
        color: BY_KEY[category]?.color,
        budget: b.amount,
        spent: catSpent,
        remaining: b.amount - catSpent,
        ratio: b.amount > 0 ? Math.min(catSpent / b.amount, 1) : 0,
        over: catSpent > b.amount,
        isOverride: b.month === p.month,
      };
    })
    .sort((a, b) => b.budget - a.budget);          // chips ordered by budget size

  const allocated = chips.reduce((s, c) => s + c.budget, 0);

  return {
    period: p,
    comparison,
    ring: {
      total: totalBudget,
      spent,
      remaining,                                    // may be negative — the UI floors the arc, not the number
      ratio: totalBudget > 0 ? Math.min(spent / totalBudget, 1) : 0,
      over: spent > totalBudget && totalBudget > 0,
    },
    pace: paceFor(spent, totalBudget, p.elapsedDays, p.totalDays),
    chips,
    unallocated: totalBudget - allocated,           // may be negative; surfaced, not forced to zero
    todaySpent: summary.todaySpent,
    needsReview: summary.needsReview,
    txnCount: summary.txnCount,
  };
}

/**
 * Fired on write, once per budget per month. The fired state lives in Mongo,
 * so a restart does not re-fire every breach (§11.13).
 */
async function checkBreaches(userId, monthStr, io) {
  const s = await status(userId, monthStr);
  const month = s.period.month;
  const fired = [];

  const raise = async (type, scope, category, title, body) => {
    try {
      const alert = await Alert.create({ userId, type, scope, category, month, title, body });
      fired.push(alert);
      io?.to(`user:${userId}`).emit('budget:breach', { type, scope, category, month, title, body });
    } catch (err) {
      if (err.code !== 11000) throw err;            // 11000 = already fired this month
    }
  };

  if (s.ring.total > 0 && s.ring.spent >= s.ring.total) {
    await raise('total_100', 'total', null, 'Monthly budget spent', `You have used your entire ${s.period.label} budget.`);
  }
  for (const c of s.chips) {
    if (c.spent >= c.budget) {
      await raise('budget_100', 'category', c.category, `${c.label} budget spent`, `${c.label} is fully used for ${s.period.label}.`);
    } else if (c.ratio >= 0.8) {
      await raise('budget_80', 'category', c.category, `${c.label} at 80%`, `You have used 80% of your ${c.label} budget.`);
    }
  }
  return fired;
}

module.exports = { resolveBudgets, status, checkBreaches, paceFor };
