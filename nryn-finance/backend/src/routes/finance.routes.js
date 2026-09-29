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
router.patch('/budgets/:id', budget.patchBudget);
router.delete('/budgets/:id', budget.deleteBudget);

const hub = require('../finance/hub.controller');

// ── Smart Financial Hub & AI Document Analysis ──
router.post('/ai/analyze-document', hub.analyzeDocument);
router.post('/finance/ai/analyze-document', hub.analyzeDocument);
router.post('/ai/statement-import', hub.importStatementTransactions);
router.post('/finance/ai/statement-import', hub.importStatementTransactions);

// ── Insurance & Policies ──
router.get('/policies', hub.listPolicies);
router.get('/finance/policies', hub.listPolicies);
router.post('/policies', hub.createPolicy);
router.post('/finance/policies', hub.createPolicy);
router.delete('/policies/:id', hub.deletePolicy);
router.delete('/finance/policies/:id', hub.deletePolicy);

// ── Accounts (Savings & Loans) ──
router.get('/accounts', hub.listAccounts);
router.get('/finance/accounts', hub.listAccounts);
router.post('/accounts', hub.createAccount);
router.post('/finance/accounts', hub.createAccount);
router.delete('/accounts/:id', hub.deleteAccount);
router.delete('/finance/accounts/:id', hub.deleteAccount);

// ── Cash Expense Fast Entry ──
router.post('/cash-expense', hub.createCashExpense);
router.post('/finance/cash-expense', hub.createCashExpense);

module.exports = router;

