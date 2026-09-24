'use strict';
const Budget = require('../db/models/Budget');
const Alert = require('../db/models/Alert');
const { status } = require('./budget.service');
const { resolveMonth } = require('./period');
const { CATEGORY_KEYS } = require('../shared/categories');
const N = require('../parse/normalize');

async function listBudgets(req, res) {
  const month = req.query.month ? resolveMonth(req.query.month).month : null;
  const q = { userId: req.userId };
  if (month) q.$or = [{ month }, { month: null }];
  res.json({ budgets: await Budget.find(q).lean() });
}

async function upsertBudget(req, res) {
  const { scope = 'category', category = null, amount, amountPaise, month = null } = req.body || {};
  const paise = amountPaise ?? N.toPaise(amount);
  if (paise === null || paise < 0) return res.status(400).json({ error: 'valid_amount_required' });
  if (scope === 'category' && !CATEGORY_KEYS.includes(category)) return res.status(400).json({ error: 'invalid_category' });

  const key = { userId: req.userId, scope, category: scope === 'total' ? null : category, month: month ? resolveMonth(month).month : null };
  const budget = await Budget.findOneAndUpdate(key, { $set: { amount: paise, period: 'monthly' } }, { upsert: true, new: true });
  res.json({ budget });
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

async function listAlerts(req, res) {
  const q = { userId: req.userId };
  if (req.query.unread === 'true') q.read = false;
  res.json({ alerts: await Alert.find(q).sort({ createdAt: -1 }).limit(50).lean() });
}

async function readAlert(req, res) {
  await Alert.updateOne({ _id: req.params.id, userId: req.userId }, { $set: { read: true } });
  res.json({ ok: true });
}

module.exports = { listBudgets, upsertBudget, patchBudget, deleteBudget, getStatus, listAlerts, readAlert };
