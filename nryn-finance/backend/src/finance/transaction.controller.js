'use strict';
const Transaction = require('../db/models/Transaction');
const { findDuplicate } = require('./transaction.repo');
const { rememberCorrection } = require('../ai/categorize.service');
const { checkBreaches } = require('./budget.service');
const { resolveMonth } = require('./period');
const { iconFor, CATEGORY_KEYS } = require('../shared/categories');
const N = require('../parse/normalize');

const SORTS = {
  amount_desc: { amount: -1, occurredAt: -1 },
  amount_asc: { amount: 1, occurredAt: -1 },
  date_desc: { occurredAt: -1 },
  date_asc: { occurredAt: 1 },
};

async function list(req, res) {
  const { month, from, to, category, needsReview, sort = 'date_desc', limit = 30, cursor, includeNonExpense } = req.query;

  const q = { userId: req.userId, deletedAt: null };

  if (month) {
    const p = resolveMonth(month);
    q.occurredAt = { $gte: p.start, $lte: p.end };
  }
  if (from || to) {
    q.occurredAt = q.occurredAt || {};
    if (from) q.occurredAt.$gte = new Date(from);
    if (to) q.occurredAt.$lte = new Date(to);
  }
  if (category) q.category = category;
  if (needsReview === 'true') q.needsReview = true;
  if (includeNonExpense !== 'true') { q.isExpense = true; q.direction = 'debit'; }
  if (cursor) q._id = { $lt: cursor };

  const rows = await Transaction.find(q).sort(SORTS[sort] || SORTS.date_desc).limit(Math.min(Number(limit), 100)).lean();
  res.json({
    transactions: rows,
    nextCursor: rows.length === Number(limit) ? rows[rows.length - 1]._id : null,
  });
}

async function getOne(req, res) {
  const txn = await Transaction.findOne({ _id: req.params.id, userId: req.userId, deletedAt: null }).lean();
  if (!txn) return res.status(404).json({ error: 'not_found' });
  res.json({ transaction: txn });
}

/**
 * Manual entry (§4A). Bypasses parsing entirely — a number the user typed is
 * by definition trusted. The 409 guard is what stops a cash entry made just
 * before the UPI SMS lands from double-counting the spend (§11.11).
 */
async function create(req, res) {
  const { amount, amountPaise, direction = 'debit', occurredAt, category = 'other', merchantName, note, account, isExpense } = req.body || {};

  const paise = amountPaise ?? N.toPaise(amount);
  if (paise === null || paise <= 0) return res.status(400).json({ error: 'valid_amount_required' });
  if (!CATEGORY_KEYS.includes(category)) return res.status(400).json({ error: 'invalid_category', allowed: CATEGORY_KEYS });

  const when = occurredAt ? new Date(occurredAt) : new Date();

  if (req.query.force !== 'true') {
    const dup = await findDuplicate({ userId: req.userId, refId: null, amount: paise, direction, occurredAt: when, last4: account?.last4, source: 'manual' });
    if (dup.duplicate) {
      return res.status(409).json({ error: 'possible_duplicate', rule: dup.rule, existing: dup.existing, hint: 'retry with ?force=true to add anyway' });
    }
  }

  const txn = await Transaction.create({
    userId: req.userId,
    source: 'manual',
    amount: paise,
    direction,
    occurredAt: when,
    merchantName: merchantName || null,
    merchantIcon: iconFor(category),
    category,
    categorySource: 'user',
    categoryConfidence: 1,
    account,
    method: 'manual',
    isExpense: typeof isExpense === 'boolean' ? isExpense : direction === 'debit',
    note,
    parseConfidence: 1,
    needsReview: false,
    userEdited: { amount: true, category: true, merchantName: Boolean(merchantName), isExpense: typeof isExpense === 'boolean' },
  });

  if (merchantName) await rememberCorrection({ userId: req.userId, merchantName, category });
  checkBreaches(req.userId, resolveMonth(when.toISOString().slice(0, 7)).month, req.app.get('io')).catch(() => {});

  res.status(201).json({ transaction: txn });
}

async function update(req, res) {
  const txn = await Transaction.findOne({ _id: req.params.id, userId: req.userId, deletedAt: null });
  if (!txn) return res.status(404).json({ error: 'not_found' });

  const { amount, amountPaise, category, merchantName, isExpense, note } = req.body || {};
  const edited = txn.userEdited || {};

  if (amount !== undefined || amountPaise !== undefined) {
    const paise = amountPaise ?? N.toPaise(amount);
    if (paise === null || paise <= 0) return res.status(400).json({ error: 'valid_amount_required' });
    txn.amount = paise; edited.amount = true;
  }
  if (category !== undefined) {
    if (!CATEGORY_KEYS.includes(category)) return res.status(400).json({ error: 'invalid_category' });
    txn.category = category;
    txn.categorySource = 'user';
    txn.categoryConfidence = 1;
    txn.merchantIcon = txn.merchantIcon || iconFor(category);
    edited.category = true;
    // THE learning step: correct once, right forever.
    if (txn.merchantName) await rememberCorrection({ userId: req.userId, merchantName: txn.merchantName, category, icon: txn.merchantIcon });
  }
  if (merchantName !== undefined) { txn.merchantName = merchantName; edited.merchantName = true; }
  if (isExpense !== undefined) { txn.isExpense = Boolean(isExpense); edited.isExpense = true; }
  if (note !== undefined) txn.note = note;

  txn.userEdited = edited;
  txn.needsReview = false;
  await txn.save();

  checkBreaches(req.userId, resolveMonth(txn.occurredAt.toISOString().slice(0, 7)).month, req.app.get('io')).catch(() => {});
  res.json({ transaction: txn });
}

async function remove(req, res) {
  const r = await Transaction.updateOne({ _id: req.params.id, userId: req.userId }, { $set: { deletedAt: new Date() } });
  if (!r.matchedCount) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
}

module.exports = { list, getOne, create, update, remove };
