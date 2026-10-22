'use strict';
const Transaction = require('../db/models/Transaction');
const { findDuplicate } = require('./transaction.repo');
const { rememberCorrection } = require('../ai/categorize.service');
const { checkBreaches } = require('./budget.service');
const { resolveMonth } = require('./period');
const { iconFor, CATEGORY_KEYS } = require('../shared/categories');
const N = require('../parse/normalize');
const { isConnected } = require('../db/mongo');
const { store, save } = require('../db/fallback.store');

const SORTS = {
  amount_desc: { amount: -1, occurredAt: -1 },
  amount_asc: { amount: 1, occurredAt: -1 },
  date_desc: { occurredAt: -1 },
  date_asc: { occurredAt: 1 },
};

async function list(req, res) {
  try {
    if (!isConnected()) {
      const { inferCategory, iconFor } = require('../shared/categories');
      const uid = String(req.userId);
      let rows = (store.transactions || []).filter((t) => String(t.userId) === uid && !t.deletedAt);

      for (const t of rows) {
        if (!t.category || t.category === 'other') {
          const inferred = inferCategory(t.merchantName, t.merchantRaw);
          if (inferred !== 'other') {
            t.category = inferred;
            t.merchantIcon = iconFor(inferred);
          }
        }
      }

      if (req.query.month) {
        const p = resolveMonth(req.query.month);
        rows = rows.filter((t) => {
          const d = new Date(t.occurredAt);
          return d >= p.start && d <= p.end;
        });
      }
      if (req.query.category) rows = rows.filter((t) => t.category === req.query.category);
      if (req.query.includeNonExpense !== 'true') {
        rows = rows.filter((t) => t.isExpense && t.direction === 'debit');
      }

      const sort = req.query.sort || 'date_desc';
      if (sort === 'date_desc') rows.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
      if (sort === 'date_asc') rows.sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
      if (sort === 'amount_desc') rows.sort((a, b) => b.amount - a.amount);
      if (sort === 'amount_asc') rows.sort((a, b) => a.amount - b.amount);

      const limit = Math.min(Number(req.query.limit) || 30, 100);
      return res.json({
        transactions: rows.slice(0, limit),
        nextCursor: rows.length > limit ? rows[limit - 1]._id : null,
      });
    }

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
  } catch (err) {
    res.json({ transactions: [], nextCursor: null });
  }
}

async function getOne(req, res) {
  try {
    if (!isConnected()) {
      const txn = store.transactions.find((t) => t._id === req.params.id && t.userId === req.userId && !t.deletedAt);
      if (!txn) return res.status(404).json({ error: 'not_found' });
      return res.json({ transaction: txn });
    }
    const txn = await Transaction.findOne({ _id: req.params.id, userId: req.userId, deletedAt: null }).lean();
    if (!txn) return res.status(404).json({ error: 'not_found' });
    res.json({ transaction: txn });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function create(req, res) {
  try {
    const { amount, amountPaise, direction = 'debit', merchant, category, notes, occurredAt, accountMask, paymentMode } = req.body || {};
    const paise = amountPaise ?? N.toPaise(amount);
    if (paise === null || paise <= 0) {
      return res.status(400).json({ error: 'valid_amount_required' });
    }

    if (!isConnected()) {
      const newTxn = {
        _id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        userId: req.userId,
        amount: paise,
        direction,
        merchant: merchant ? String(merchant).trim() : 'Manual Expense',
        category: category || 'others',
        notes: notes || '',
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
        accountMask: accountMask || 'Cash',
        paymentMode: paymentMode || 'cash',
        isExpense: direction === 'debit',
        source: 'manual',
        createdAt: new Date().toISOString(),
      };
      store.transactions.unshift(newTxn);
      save();
      return res.status(201).json({ transaction: newTxn });
    }

    const txn = await Transaction.create({
      userId: req.userId,
      amount: paise,
      direction,
      merchant: merchant ? String(merchant).trim() : 'Manual Expense',
      category: category || 'others',
      notes,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      accountMask,
      paymentMode,
      isExpense: direction === 'debit',
      source: 'manual',
    });
    res.status(201).json({ transaction: txn });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function update(req, res) {
  try {
    const { category, notes, merchant } = req.body || {};
    if (!isConnected()) {
      const txn = store.transactions.find((t) => t._id === req.params.id && t.userId === req.userId);
      if (!txn) return res.status(404).json({ error: 'not_found' });
      if (category) txn.category = category;
      if (notes !== undefined) txn.notes = notes;
      if (merchant) txn.merchant = merchant;
      save();
      return res.json({ transaction: txn });
    }

    const $set = {};
    if (category) $set.category = category;
    if (notes !== undefined) $set.notes = notes;
    if (merchant) $set.merchant = merchant;

    const txn = await Transaction.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { $set }, { new: true });
    if (!txn) return res.status(404).json({ error: 'not_found' });
    res.json({ transaction: txn });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function remove(req, res) {
  try {
    if (!isConnected()) {
      const txn = store.transactions.find((t) => t._id === req.params.id && t.userId === req.userId);
      if (!txn) return res.status(404).json({ error: 'not_found' });
      txn.deletedAt = new Date().toISOString();
      save();
      return res.json({ ok: true });
    }

    const txn = await Transaction.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { $set: { deletedAt: new Date() } }, { new: true });
    if (!txn) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { list, getOne, create, update, remove };
