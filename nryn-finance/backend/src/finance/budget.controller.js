'use strict';
const Budget = require('../db/models/Budget');
const Alert = require('../db/models/Alert');
const { status } = require('./budget.service');
const { monthSummary } = require('./analytics.service');
const { resolveMonth } = require('./period');
const { CATEGORY_KEYS } = require('../shared/categories');
const N = require('../parse/normalize');

async function listBudgets(req, res) {
  const month = req.query.month ? resolveMonth(req.query.month).month : null;
  const q = { userId: req.userId };
  if (month) q.$or = [{ month }, { month: null }];
  res.json({ budgets: await Budget.find(q).lean() });
}

async function upsertBudget(req, res, next) {
  try {
    const { scope = 'category', category = null, amount, amountPaise, month = null } = req.body || {};
    const paise = amountPaise ?? N.toPaise(amount);
    if (paise === null || isNaN(paise) || paise < 0) {
      return res.status(400).json({ error: 'valid_amount_required' });
    }
    if (scope === 'category' && !CATEGORY_KEYS.includes(category)) {
      return res.status(400).json({ error: 'invalid_category' });
    }

    const targetCategory = (scope === 'total' || scope === 'daily') ? null : category;
    const targetMonth = month ? resolveMonth(month).month : null;

    const key = { userId: req.userId, scope, category: targetCategory, month: targetMonth };
    const budget = await Budget.findOneAndUpdate(
      key,
      { $set: { amount: paise, period: scope === 'daily' ? 'daily' : 'monthly' } },
      { upsert: true, new: true }
    );

    // If saving rolling default (month is null), also synchronize current month override if one existed
    if (!targetMonth) {
      try {
        const curMonth = resolveMonth().month;
        await Budget.updateMany(
          { userId: req.userId, scope, category: targetCategory, month: curMonth },
          { $set: { amount: paise } }
        );
      } catch (errSync) {
        // non-blocking
      }
    }

    res.json({ ok: true, budget });
  } catch (err) {
    console.error('upsertBudget error:', err);
    res.status(500).json({ error: err.message || 'failed_to_save_budget' });
  }
}

async function patchBudget(req, res) {
  const { amount, amountPaise } = req.body || {};
  const paise = amountPaise ?? N.toPaise(amount);
  if (paise === null || paise < 0) return res.status(400).json({ error: 'valid_amount_required' });
  const budget = await Budget.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { $set: { amount: paise } }, { new: true });
  if (!budget) return res.status(404).json({ error: 'not_found' });
  res.json({ budget });
}

async function deleteBudget(req, res) {
  const r = await Budget.deleteOne({ _id: req.params.id, userId: req.userId });
  if (!r.deletedCount) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
}

/** Ring + chips + pace copy, one call. */
async function getStatus(req, res) {
  res.json(await status(req.userId, req.query.month));
}

/**
 * Budget suggestion from the user's OWN spending (never a made-up default).
 * Looks at the last 3 completed months that have data; if none, projects the
 * current month. The user must confirm — nothing is saved here.
 */
async function getSuggestion(req, res, next) {
  try {
    const months = [];
    let m = resolveMonth();
    const current = await monthSummary(req.userId, m.month);
    for (let i = 0; i < 3; i++) {
      m = resolveMonth(m.prev);
      const s = await monthSummary(req.userId, m.month);
      if ((s.spent || 0) > 0) months.push({ month: m.month, label: m.shortLabel, spent: s.spent, income: s.income || 0 });
    }

    let avgSpentPaise = 0;
    let basis = 'none';
    if (months.length) {
      avgSpentPaise = Math.round(months.reduce((a, x) => a + x.spent, 0) / months.length);
      basis = 'history';
    } else if ((current.spent || 0) > 0) {
      const p = resolveMonth();
      avgSpentPaise = Math.round((current.spent / Math.max(1, p.elapsedDays)) * p.totalDays);
      basis = 'projection';
    }
    const avgIncomePaise = months.length ? Math.round(months.reduce((a, x) => a + x.income, 0) / months.length) : 0;

    const round500 = (paise) => Math.max(0, Math.round(paise / 100 / 500) * 500); // rupees
    const avg = round500(avgSpentPaise);
    const options = avg > 0
      ? [
          { key: 'save10', label: 'Save 10%', amount: round500(avgSpentPaise * 0.9), recommended: true },
          { key: 'same', label: 'Same as usual', amount: avg },
          { key: 'save20', label: 'Save 20%', amount: round500(avgSpentPaise * 0.8) },
        ]
      : [];

    res.json({
      basis,
      monthsUsed: months,
      avgMonthlySpend: Math.round(avgSpentPaise / 100),
      avgMonthlyIncome: Math.round(avgIncomePaise / 100),
      options,
    });
  } catch (err) {
    next(err);
  }
}

async function listAlerts(req, res) {
  const q = { userId: req.userId };
  if (req.query.unread === 'true') q.read = false;
  res.json({ alerts: await Alert.find(q).sort({ createdAt: -1 }).limit(50).lean() });
}

async function readAlert(req, res) {
  await Alert.updateOne({ _id: req.params.id, userId: req.userId }, { $set: { read: true } });
  res.json({ ok: true });
}

module.exports = { getSuggestion, listBudgets, upsertBudget, patchBudget, deleteBudget, getStatus, listAlerts, readAlert };
