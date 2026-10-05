'use strict';
const { processChat } = require('./copilot.service');
const { calculateSafeSpend } = require('./safespend.service');
const { detectAnomalies } = require('./anomaly.service');
const { detectSubscriptions } = require('./subscription.service');
const { calculateLoanPrepayment } = require('./loan.service');
const { calculateTaxRadar } = require('./tax.service');
const { generateRecommendations } = require('./recommendations.service');

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
    } = req.body;

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

