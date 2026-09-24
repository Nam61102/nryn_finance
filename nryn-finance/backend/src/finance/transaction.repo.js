'use strict';
const Transaction = require('../db/models/Transaction');

const MINUTES = 60 * 1000;

/**
 * Dedupe chain, cheapest check first (§5.5).
 * Returns { duplicate: true, existing } or { duplicate: false }.
 */
async function findDuplicate({ userId, refId, amount, direction, occurredAt, last4, source }) {
  // 2 — the cross-source case: one card swipe arrives as BOTH an SMS and a
  //     Gmail alert. This is what stops Gmail doubling your month.
  if (refId) {
    const byRef = await Transaction.findOne({ userId, refId, deletedAt: null });
    if (byRef) return { duplicate: true, existing: byRef, rule: 'refId' };
  }

  // 3 — fuzzy fallback when refId is absent.
  const window = source === 'manual' ? 30 * MINUTES : 3 * MINUTES;
  const q = {
    userId,
    amount,
    direction,
    deletedAt: null,
    occurredAt: { $gte: new Date(occurredAt.getTime() - window), $lte: new Date(occurredAt.getTime() + window) },
  };
  if (last4) q['account.last4'] = last4;

  const near = await Transaction.findOne(q);
  if (near) return { duplicate: true, existing: near, rule: last4 ? 'fuzzy_last4' : 'fuzzy_amount_time' };

  return { duplicate: false };
}

/**
 * Rule 4 (§5.5): a parsed transaction landing on top of an earlier MANUAL row
 * for the same spend. Keep the parsed one — it carries refId, last4 and the
 * real merchant string — but inherit what the human typed, then soft-delete
 * the manual row. The user typed it first; don't lose what they said.
 */
async function mergeOverManual(parsedDoc, manualDoc) {
  const inherited = {};
  if (manualDoc.note) inherited.note = manualDoc.note;
  if (manualDoc.categorySource === 'user') {
    inherited.category = manualDoc.category;
    inherited.categorySource = 'user';
    inherited.categoryConfidence = 1;
    inherited['userEdited.category'] = true;
  }
  Object.assign(parsedDoc, inherited);
  await parsedDoc.save();
  await Transaction.updateOne({ _id: manualDoc._id }, { $set: { deletedAt: new Date() } });
  return parsedDoc;
}

module.exports = { findDuplicate, mergeOverManual };
