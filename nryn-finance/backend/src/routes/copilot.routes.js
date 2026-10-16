'use strict';
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../auth/session.middleware');
const copilot = require('../copilot/copilot.controller');
const voice = require('../copilot/voice.controller');

// All Copilot routes require authentication
router.use(requireAuth);

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => (req.userId ? String(req.userId) : req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limit_exceeded', message: 'Chat rate limit reached. Please wait a minute.' },
});

// 1. Natural Language Conversational Copilot
router.post('/chat', chatLimiter, copilot.chat);
router.post('/chat/stream', chatLimiter, copilot.chatStream);
router.post('/voice/transcribe', voice.uploadMiddleware, voice.transcribe);

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

// 7. Dynamic AI Merchant & Overspending Recommendations
router.get('/recommendations', copilot.getRecommendations);

// 8. AI Agent Live Financial Briefing & Status Pill
router.get('/briefing', copilot.getAgentBriefing);

// 9. Autonomous Pre-Purchase Simulation ("Can I Afford This?")
router.post('/simulate-purchase', copilot.simulatePurchase);

module.exports = router;
