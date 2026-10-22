'use strict';
const { DateTime } = require('luxon');
const Transaction = require('../db/models/Transaction');
const { resolveBudgets } = require('../finance/budget.service');
const { resolveMonth, ZONE } = require('../finance/period');

/**
 * AI Autonomous Pre-Purchase Simulator Service
 * Evaluates real-time financial impact of prospective purchases before user spends money.
 * Computes:
 * - Current vs Projected Remaining Budget
 * - Current vs Projected Daily Safe Discretionary Allowance
 * - Allowance shrink percentage & velocity impact
 * - Autonomous AI Verdict (SAFE / CAUTION / DEFICIT_RISK)
 * - Proactive offset strategy (delay recommendations, daily savings targets)
 */
async function simulatePurchase(userId, { amount, category = 'General', item = 'Prospective Purchase', month } = {}) {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    const error = new Error('Amount must be a positive number greater than 0.');
    error.status = 400;
    error.code = 'invalid_amount';
    throw error;
  }

  const p = resolveMonth(month);
  const now = DateTime.now().setZone(ZONE);

  const amountINR = Math.round(numAmount);
  const amountPaise = amountINR * 100;

  // 1. Fetch current month expenses
  const { isConnected } = require('../db/mongo');
  const { store } = require('../db/fallback.store');
  const { Types } = require('mongoose');
  const uid = String(userId);
  let txns = [];
  if (!isConnected()) {
    txns = (store.transactions || []).filter((t) => {
      if (String(t.userId) !== uid || t.deletedAt || !t.isExpense || t.direction !== 'debit') return false;
      const d = new Date(t.occurredAt);
      return d >= p.start && d <= p.end;
    });
  } else {
    const isObjectId = Types.ObjectId.isValid(userId);
    const mongoUserId = isObjectId ? new Types.ObjectId(userId) : userId;
    txns = await Transaction.find({
      userId: mongoUserId,
      direction: 'debit',
      isExpense: true,
      deletedAt: null,
      occurredAt: { $gte: p.start, $lte: p.end },
    }).select('amount category').lean().catch(() => []);
  }

  const totalSpentPaise = txns.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalSpentINR = Math.round(totalSpentPaise / 100);

  // Category specific spend
  const normalizedCategory = (category || 'General').trim().toLowerCase();
  const categorySpentPaise = txns
    .filter((t) => (t.category || '').toLowerCase() === normalizedCategory)
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const categorySpentINR = Math.round(categorySpentPaise / 100);

  // 2. Fetch User's Budgets
  let totalBudgetPaise = 0;
  let categoryBudgetPaise = 0;
  let hasConfiguredBudget = false;

  try {
    const resolved = await resolveBudgets(userId, p.month);
    if (resolved?.total?.amount > 0) {
      totalBudgetPaise = resolved.total.amount;
      hasConfiguredBudget = true;
    }
    if (resolved?.categories && Array.isArray(resolved.categories)) {
      const catBudget = resolved.categories.find(
        (c) => (c.name || '').toLowerCase() === normalizedCategory
      );
      if (catBudget && catBudget.amount > 0) {
        categoryBudgetPaise = catBudget.amount;
      }
    }
  } catch {
    // budget service fallback
  }

  // If user has not configured a budget, use a safe baseline of ₹30,000 or (spent + 15,000)
  if (totalBudgetPaise <= 0) {
    totalBudgetPaise = Math.max(3000000, totalSpentPaise + 1500000);
  }

  const totalBudgetINR = Math.round(totalBudgetPaise / 100);
  const currentDay = p.isCurrent ? now.day : p.totalDays;
  const daysRemaining = p.isCurrent ? Math.max(1, p.totalDays - currentDay + 1) : 1;

  // 3. Current Baseline State
  const currentRemainingBudgetPaise = Math.max(0, totalBudgetPaise - totalSpentPaise);
  const currentRemainingBudgetINR = Math.round(currentRemainingBudgetPaise / 100);
  const currentDailySafePaise = Math.floor(currentRemainingBudgetPaise / daysRemaining);
  const currentDailySafeINR = Math.round(currentDailySafePaise / 100);
  const currentBudgetUsagePercent = Math.min(100, Math.round((totalSpentPaise / totalBudgetPaise) * 100));

  // 4. Projected Post-Purchase State
  const projectedSpentPaise = totalSpentPaise + amountPaise;
  const projectedSpentINR = Math.round(projectedSpentPaise / 100);
  const projectedRemainingBudgetPaise = totalBudgetPaise - projectedSpentPaise;
  const projectedRemainingBudgetINR = Math.round(projectedRemainingBudgetPaise / 100);

  const projectedDailySafePaise = projectedRemainingBudgetPaise > 0 
    ? Math.floor(projectedRemainingBudgetPaise / daysRemaining) 
    : 0;
  const projectedDailySafeINR = Math.round(projectedDailySafePaise / 100);

  const dailyDropINR = Math.max(0, currentDailySafeINR - projectedDailySafeINR);
  const dailyDropPercent = currentDailySafeINR > 0 
    ? Math.min(100, Math.round((dailyDropINR / currentDailySafeINR) * 100)) 
    : 100;
  const projectedBudgetUsagePercent = Math.min(150, Math.round((projectedSpentPaise / totalBudgetPaise) * 100));

  // Category Projection
  const projectedCategorySpentINR = categorySpentINR + amountINR;
  const categoryBudgetINR = Math.round(categoryBudgetPaise / 100);
  const isCategoryOverbudget = categoryBudgetINR > 0 && projectedCategorySpentINR > categoryBudgetINR;

  // 5. Autonomous Verdict & Narrative Decision Engine
  let verdict = 'SAFE';
  let badge = 'APPROVED · SAFE TO BUY';
  let badgeColor = '#16A34A'; // Green accent
  let title = 'Safe to Spend';
  let summary = '';
  let recommendation = '';
  let isAffordable = true;

  if (projectedRemainingBudgetPaise < 0) {
    verdict = 'DEFICIT_RISK';
    badge = 'HIGH RISK · OVER BUDGET';
    badgeColor = '#DC2626'; // Alert Red
    title = 'Budget Deficit Risk';
    isAffordable = false;
    const deficitINR = Math.abs(projectedRemainingBudgetINR);
    summary = `This purchase will push your expenses to ₹${projectedSpentINR.toLocaleString('en-IN')}, causing a ₹${deficitINR.toLocaleString('en-IN')} deficit beyond your monthly budget.`;
    recommendation = `Autonomous Recommendation: Delay this purchase by ${daysRemaining} days until next month's salary, or cut non-essential expenses by ₹${deficitINR.toLocaleString('en-IN')}.`;
  } else if (dailyDropPercent >= 35 || projectedDailySafeINR < 200 || isCategoryOverbudget) {
    verdict = 'CAUTION';
    badge = 'MODERATE IMPACT · TIGHTENS BUDGET';
    badgeColor = '#FF6D00'; // Signature Orange
    title = 'Affordable with Budget Squeeze';
    isAffordable = true;
    summary = `You can afford this, but your daily discretionary allowance will drop from ₹${currentDailySafeINR} to ₹${projectedDailySafeINR}/day (↓${dailyDropPercent}%) for the next ${daysRemaining} days.`;
    if (isCategoryOverbudget) {
      recommendation = `Attention: This will exceed your '${category}' category budget by ₹${(projectedCategorySpentINR - categoryBudgetINR).toLocaleString('en-IN')}. Consider reallocating from other categories.`;
    } else {
      const dailyOffset = Math.round(amountINR / Math.min(7, daysRemaining));
      recommendation = `Proactive Strategy: Trim ₹${dailyOffset}/day on discretionary spends over the next ${Math.min(7, daysRemaining)} days to absorb this purchase seamlessly.`;
    }
  } else {
    verdict = 'SAFE';
    badge = 'APPROVED · SAFE TO BUY';
    badgeColor = '#16A34A';
    title = 'Safe to Spend';
    isAffordable = true;
    summary = `Approved by NRYN AI. Your financial runway comfortably absorbs this ₹${amountINR.toLocaleString('en-IN')} purchase.`;
    recommendation = `You will maintain a healthy ₹${projectedDailySafeINR}/day safe allowance with ₹${projectedRemainingBudgetINR.toLocaleString('en-IN')} cushion remaining.`;
  }

  // 6. Savings & Offset Alternatives
  const suggestedSavingsPerDay = Math.round(amountINR / Math.max(1, daysRemaining));
  const suggestedInstallment3Mo = Math.round(amountINR / 3);

  return {
    ok: true,
    purchase: {
      item: item || 'Prospective Purchase',
      category,
      amountINR,
      amountPaise,
    },
    verdict: {
      status: verdict,
      badge,
      badgeColor,
      title,
      summary,
      recommendation,
      isAffordable,
    },
    metrics: {
      daysRemaining,
      hasConfiguredBudget,
      totalBudgetINR,
      // Before Purchase
      current: {
        spentINR: totalSpentINR,
        remainingBudgetINR: currentRemainingBudgetINR,
        dailySafeINR: currentDailySafeINR,
        budgetUsagePercent: currentBudgetUsagePercent,
      },
      // After Purchase
      projected: {
        spentINR: projectedSpentINR,
        remainingBudgetINR: projectedRemainingBudgetINR,
        dailySafeINR: projectedDailySafeINR,
        budgetUsagePercent: projectedBudgetUsagePercent,
        dailyDropINR,
        dailyDropPercent,
      },
      // Category Specific
      categoryAnalysis: {
        category,
        currentSpentINR: categorySpentINR,
        projectedSpentINR: projectedCategorySpentINR,
        categoryBudgetINR,
        isOverbudget: isCategoryOverbudget,
      },
    },
    actionPlan: {
      suggestedDelayDays: daysRemaining,
      dailySavingsOffsetINR: suggestedSavingsPerDay,
      installment3MoINR: suggestedInstallment3Mo,
    },
    simulatedAt: now.toISO(),
  };
}

module.exports = {
  simulatePurchase,
};
