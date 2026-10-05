'use strict';
const router = require('express').Router();
const { requireAuth } = require('../auth/session.middleware');
const copilot = require('../copilot/copilot.controller');

// All Copilot routes require authentication
router.use(requireAuth);

// 1. Natural Language Conversational Copilot
router.post('/chat', copilot.chat);

// 2. Safe-to-Spend Daily Allowance & Burn Rate
router.get('/safe-to-spend', copilot.getSafeSpend);

// 3. Proactive Anomaly & Fraud Watchdog
router.get('/anomalies', copilot.getAnomalies);

// 4. Recurring Subscriptions & Zombie Hunter
router.get('/subscriptions', copilot.getSubscriptions);

// 5. Loan Prepayment & EMI Saver Simulator
router.post('/loan-simulator', copilot.simulateLoan);

// 6. Section 80C / 80D Tax-Saving Discovery Radar
router.get('/tax-radar', copilot.getTaxRadar);

module.exports = router;
