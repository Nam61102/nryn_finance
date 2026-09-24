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

router.get('/alerts', budget.listAlerts);
router.patch('/alerts/:id/read', budget.readAlert);

module.exports = router;
