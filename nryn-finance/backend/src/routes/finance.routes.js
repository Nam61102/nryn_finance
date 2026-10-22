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

const { isConnected } = require('../db/mongo');
const { store } = require('../db/fallback.store');
const { resolveMonth } = require('../finance/period');

router.get('/analytics/summary', async (req, res) => {
  if (!isConnected()) {
    const p = resolveMonth(req.query.month);
    const userTxns = (store.transactions || []).filter(
      (t) => {
        if (String(t.userId) !== String(req.userId) || t.deletedAt) return false;
        const d = new Date(t.occurredAt);
        return d >= p.start && d <= p.end;
      }
    );
    const spent = userTxns.filter((t) => t.isExpense && t.direction === 'debit').reduce((s, t) => s + (t.amount || 0), 0);
    const income = userTxns.filter((t) => t.direction === 'credit' && t.category === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    return res.json({ period: p, spent, income, count: userTxns.length, net: income - spent, topCategory: null });
  }
  res.json(await analytics.monthSummary(req.userId, req.query.month));
});

router.get('/analytics/by-category', async (req, res) => {
  if (!isConnected()) {
    const { BY_KEY, inferCategory } = require('../shared/categories');
    const p = resolveMonth(req.query.month);
    const userTxns = (store.transactions || []).filter(
      (t) => {
        if (String(t.userId) !== String(req.userId) || t.deletedAt || !t.isExpense || t.direction !== 'debit') return false;
        const d = new Date(t.occurredAt);
        return d >= p.start && d <= p.end;
      }
    );
    const catMap = {};
    const catTxnCounts = {};
    for (const t of userTxns) {
      let c = t.category;
      if (!c || c === 'other') {
        c = inferCategory(t.merchantName, t.merchantRaw);
      }
      catMap[c] = (catMap[c] || 0) + (t.amount || 0);
      catTxnCounts[c] = (catTxnCounts[c] || 0) + 1;
    }
    const categories = Object.entries(catMap).map(([category, spent]) => ({
      category,
      label: BY_KEY[category]?.label || category,
      icon: BY_KEY[category]?.icon || '📦',
      color: BY_KEY[category]?.color || '#FF6D00',
      spent,
      count: catTxnCounts[category] || 0,
    })).sort((a, b) => b.spent - a.spent);
    const totalSpent = categories.reduce((s, c) => s + c.spent, 0);
    return res.json({ period: p, categories, totalSpent });
  }
  res.json(await analytics.byCategory(req.userId, req.query.month));
});

router.get('/analytics/series', async (req, res) => {
  if (!isConnected()) return res.json({ series: [] });
  res.json(await analytics.series(req.userId, req.query.range, req.query.bucket));
});

router.get('/analytics/months', async (req, res) => {
  if (!isConnected()) {
    const uid = String(req.userId);
    const userTxns = (store.transactions || []).filter((t) => String(t.userId) === uid && !t.deletedAt);
    const monthCounts = {};
    for (const t of userTxns) {
      if (t.occurredAt) {
        const m = String(t.occurredAt).slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(m)) {
          monthCounts[m] = (monthCounts[m] || 0) + 1;
        }
      }
    }
    const current = resolveMonth().month;
    if (!monthCounts[current]) monthCounts[current] = 0;
    const sorted = Object.keys(monthCounts).sort().reverse();
    const months = sorted.map((m) => ({ month: m, count: monthCounts[m], ...resolveMonth(m) }));
    return res.json({ months });
  }
  res.json({ months: await analytics.availableMonths(req.userId) });
});

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
  max: 60,
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

