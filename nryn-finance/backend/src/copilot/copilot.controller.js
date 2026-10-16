'use strict';
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
    const result = await detectAnomalies(req.userId);
    return res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── 4. Recurring Subscriptions & Zombie Hunter ──
exports.getSubscriptions = async (req, res, next) => {
  try {
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


