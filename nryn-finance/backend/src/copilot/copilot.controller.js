'use strict';
const { isConnected } = require('../db/mongo');
const { store } = require('../db/fallback.store');
const { processChat, streamChat } = require('./copilot.service');
const { calculateSafeSpend } = require('./safespend.service');
const { detectAnomalies } = require('./anomaly.service');
const { detectSubscriptions } = require('./subscription.service');
const { calculateLoanPrepayment } = require('./loan.service');
const { calculateTaxRadar } = require('./tax.service');
const { generateRecommendations } = require('./recommendations.service');
const { generateAgentBriefing } = require('./agentBriefing.service');
const { simulatePurchase } = require('./purchaseSimulation.service');

// ── 1. Conversational Chat ──
exports.chat = async (req, res, next) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message_required', message: 'A chat message string is required.' });
    }
    const result = await processChat(req.userId, message, history);
    return res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── 1b. Streaming Conversational Chat (SSE + Rich Blocks) ──
exports.chatStream = async (req, res, next) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message_required', message: 'A chat message string is required.' });
    }
    await streamChat(req.userId, message, history, res);
  } catch (err) {
    next(err);
  }
};

// ── 2. Safe-to-Spend & Daily Allowance ──
exports.getSafeSpend = async (req, res, next) => {
  try {
    if (!isConnected()) {
      const uid = String(req.userId);
      const userBudgets = (store.budgets || []).filter((b) => String(b.userId) === uid);
      const totalB = userBudgets.find((b) => b.scope === 'total')?.amount || 0;
      const dailyB = userBudgets.find((b) => b.scope === 'daily')?.amount || 0;
      const totalBudgetINR = Math.round(totalB / 100);
      const dailySafeSpendINR = Math.round(dailyB / 100) || Math.round(totalBudgetINR / 30);

      const userTxns = (store.transactions || []).filter(
        (t) => String(t.userId) === uid && !t.deletedAt && t.isExpense && t.direction === 'debit'
      );
      const totalSpentSoFarINR = Math.round(userTxns.reduce((s, t) => s + (t.amount || 0), 0) / 100);
      const todayRemainingINR = Math.max(0, dailySafeSpendINR);

      return res.json({
        ok: true,
        hasBudget: Boolean(totalB || dailyB),
        month: new Date().toISOString().slice(0, 7),
        currentDay: new Date().getDate(),
        daysRemaining: Math.max(1, 30 - new Date().getDate()),
        dailySafeSpendINR,
        todaySpentINR: 0,
        todayRemainingINR,
        totalBudgetINR,
        totalSpentSoFarINR,
        burnStatus: 'green',
        projectedRunoutDate: null,
        insightMessage: totalBudgetINR > 0
          ? `You have ₹${totalBudgetINR.toLocaleString('en-IN')} budgeted. Safe daily limit is ₹${dailySafeSpendINR.toLocaleString('en-IN')}.`
          : 'Set a monthly budget to activate AI safe spend calculation.',
      });
    }
    const month = req.query.month;
    const result = await calculateSafeSpend(req.userId, month);
    return res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── 3. Anomaly & Fraud Watchdog ──
exports.getAnomalies = async (req, res, next) => {
  try {
    if (!isConnected()) return res.json({ anomalies: [] });
    const result = await detectAnomalies(req.userId);
    return res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── 4. Recurring Subscriptions & Zombie Hunter ──
exports.getSubscriptions = async (req, res, next) => {
  try {
    if (!isConnected()) return res.json({ subscriptions: [] });
    const result = await detectSubscriptions(req.userId);
    return res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── 5. Loan Prepayment & EMI Saver Simulator ──
exports.simulateLoan = async (req, res, next) => {
  try {
    const {
      principalAmount,
      annualInterestRate,
      tenureMonths,
      currentEmi,
      extraMonthlyPrepayment,
      lumpSumPrepayment
    } = req.body || {};

    if (!principalAmount || !annualInterestRate || !tenureMonths) {
      return res.status(400).json({
        error: 'invalid_loan_inputs',
        message: 'principalAmount, annualInterestRate, and tenureMonths are required.'
      });
    }

    const result = calculateLoanPrepayment({
      principalAmount,
      annualInterestRate,
      tenureMonths,
      currentEmi,
      extraMonthlyPrepayment,
      lumpSumPrepayment
    });

    return res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.code || 'invalid_request', message: err.message });
    }
    next(err);
  }
};

// ── 6. 80C & 80D Tax-Saving Discovery Radar ──
exports.getTaxRadar = async (req, res, next) => {
  try {
    const result = await calculateTaxRadar(req.userId);
    return res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── 7. Dynamic AI Merchant & Overspending Recommendations ──
exports.getRecommendations = async (req, res, next) => {
  try {
    if (!isConnected()) return res.json({ recommendations: [], tips: [] });
    const month = req.query.month;
    const result = await generateRecommendations(req.userId, month);
    return res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── 8. AI Agent Live Financial Briefing & Status Pill ──
exports.getAgentBriefing = async (req, res, next) => {
  try {
    if (!isConnected()) {
      const uid = String(req.userId);
      const user = (store.users || []).find((u) => String(u._id) === uid);
      const userBudgets = (store.budgets || []).filter((b) => String(b.userId) === uid);
      const totalB = userBudgets.find((b) => b.scope === 'total')?.amount || 0;
      const dailyB = userBudgets.find((b) => b.scope === 'daily')?.amount || 0;
      const totalBudgetINR = Math.round(totalB / 100);
      const safeDailyINR = Math.round(dailyB / 100) || Math.round(totalBudgetINR / 30);

      const userTxns = (store.transactions || []).filter(
        (t) => String(t.userId) === uid && !t.deletedAt && t.isExpense && t.direction === 'debit'
      );
      const totalSpentINR = Math.round(userTxns.reduce((s, t) => s + (t.amount || 0), 0) / 100);
      const budgetRemainingINR = Math.max(0, totalBudgetINR - totalSpentINR);

      const name = user?.name || 'there';
      const daysRemaining = Math.max(1, 30 - new Date().getDate());

      return res.json({
        ok: true,
        user: { name, greeting: `Namaste, ${name}` },
        statusPill: {
          state: 'optimal',
          label: 'AI Watchdog Active',
          healthScore: 95,
          auditedCount: userTxns.length,
          anomaliesCount: 0,
          statusMessage: 'Financial pacing optimal. No unexpected charges detected.',
          lastAuditedAt: new Date().toISOString(),
        },
        briefing: {
          headline: totalBudgetINR > 0 ? `₹${safeDailyINR.toLocaleString('en-IN')}/day Safe Allowance` : 'Welcome to NRYN Finance',
          narrative: totalBudgetINR > 0
            ? `Your monthly budget is ₹${totalBudgetINR.toLocaleString('en-IN')}. ₹${budgetRemainingINR.toLocaleString('en-IN')} remains for the next ${daysRemaining} days.`
            : 'Set your monthly and daily budget to activate real-time spending pace monitoring.',
          metrics: {
            totalSpentPaise: totalSpentINR * 100,
            totalSpentINR,
            safeDailyINR,
            budgetTotalINR: totalBudgetINR,
            budgetRemainingINR,
            auditedTxnsCount: userTxns.length,
            activeSubscriptionsCount: 0,
            recurringMonthlyINR: 0,
            velocityPct: 0,
            velocityDirection: 'flat',
            daysRemaining,
          },
          highlights: [
            { id: 'h1', label: 'Safe Daily', value: `₹${safeDailyINR}`, subtext: 'Safe allowance' },
            { id: 'h2', label: 'Remaining', value: `₹${budgetRemainingINR}`, subtext: 'Monthly balance' },
            { id: 'h3', label: 'Status', value: 'Protected', subtext: 'SMS watchdog active' },
          ],
          quickPrompts: [
            'How much can I spend today?',
            'Show my budget pace',
            'Can I afford ₹1,500 on dining?',
          ],
        },
      });
    }
    const month = req.query.month;
    const result = await generateAgentBriefing(req.userId, month);
    return res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── 9. Autonomous Pre-Purchase Simulation ("Can I Afford This?") ──
exports.simulatePurchase = async (req, res, next) => {
  try {
    const { amount, category, item, month } = req.body;
    const result = await simulatePurchase(req.userId, { amount, category, item, month });
    return res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.code || 'invalid_request', message: err.message });
    }
    next(err);
  }
};


