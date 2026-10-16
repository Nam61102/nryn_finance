'use strict';
const router = require('express').Router();
const { requireAuth } = require('../auth/session.middleware');
const txn = require('../finance/transaction.controller');
const budget = require('../finance/budget.controller');
const analytics = require('../finance/analytics.service');
const { CATEGORIES } = require('../shared/categories');

router.use(requireAuth);

// One source of truth for the palette — the app fetches and caches this.
router.get('/categories', (req, res) => res.json({ categories: CATEGORIES }));

router.get('/transactions', txn.list);
router.post('/transactions', txn.create);
router.get('/transactions/:id', txn.getOne);
router.patch('/transactions/:id', txn.update);
router.delete('/transactions/:id', txn.remove);

router.get('/analytics/summary', async (req, res) => res.json(await analytics.monthSummary(req.userId, req.query.month)));
router.get('/analytics/by-category', async (req, res) => res.json(await analytics.byCategory(req.userId, req.query.month)));
router.get('/analytics/series', async (req, res) => res.json(await analytics.series(req.userId, req.query.range, req.query.bucket)));
router.get('/analytics/months', async (req, res) => res.json({ months: await analytics.availableMonths(req.userId) }));

router.get('/budgets', budget.listBudgets);
router.post('/budgets', budget.upsertBudget);
router.get('/budgets/status', budget.getStatus);
router.get('/budgets/suggestion', budget.getSuggestion);
router.patch('/budgets/:id', budget.patchBudget);
router.delete('/budgets/:id', budget.deleteBudget);

const rateLimit = require('express-rate-limit');
const hub = require('../finance/hub.controller');

const docLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req.userId ? String(req.userId) : req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limit_exceeded', message: 'Document analysis rate limit reached. Please wait 15 minutes.' },
});

// ── Smart Financial Hub & AI Document Analysis ──
router.post('/ai/analyze-document', docLimiter, hub.analyzeDocument);
router.post('/ai/statement-import', docLimiter, hub.importStatementTransactions);

// ── Insurance & Policies ──
router.get('/policies', hub.listPolicies);
router.post('/policies', hub.createPolicy);
router.delete('/policies/:id', hub.deletePolicy);

// ── Accounts (Savings & Loans) ──
router.get('/accounts', hub.listAccounts);
router.post('/accounts', hub.createAccount);
router.delete('/accounts/:id', hub.deleteAccount);

// ── Cash Expense Fast Entry ──
router.post('/cash-expense', hub.createCashExpense);

module.exports = router;

