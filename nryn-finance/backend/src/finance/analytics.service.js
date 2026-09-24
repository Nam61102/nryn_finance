'use strict';
const Transaction = require('../db/models/Transaction');
const { CATEGORIES, BY_KEY } = require('../shared/categories');
const { resolveMonth, resolveRange, ZONE, startOfToday } = require('./period');

const baseMatch = (userId, start, end) => ({
  userId,
  deletedAt: null,
  occurredAt: { $gte: start, $lte: end },
});

/** Every number on the home screen, defined once. The phone never computes. */
async function monthSummary(userId, monthStr) {
  const p = resolveMonth(monthStr);

  const [agg] = await Transaction.aggregate([
    { $match: baseMatch(userId, p.start, p.end) },
    {
      $group: {
        _id: null,
        spent: { $sum: { $cond: [{ $and: [{ $eq: ['$isExpense', true] }, { $eq: ['$direction', 'debit'] }] }, '$amount', 0] } },
        income: { $sum: { $cond: [{ $and: [{ $eq: ['$direction', 'credit'] }, { $eq: ['$category', 'income'] }] }, '$amount', 0] } },
        invested: { $sum: { $cond: [{ $eq: ['$category', 'investment'] }, '$amount', 0] } },
        txnCount: { $sum: 1 },
        needsReview: { $sum: { $cond: ['$needsReview', 1, 0] } },
      },
    },
  ]);

  const [todayAgg] = p.isCurrent
    ? await Transaction.aggregate([
        { $match: { ...baseMatch(userId, startOfToday(), p.end), isExpense: true, direction: 'debit' } },
        { $group: { _id: null, spent: { $sum: '$amount' } } },
      ])
    : [];

  return {
    period: p,
    spent: agg?.spent || 0,
    income: agg?.income || 0,
    invested: agg?.invested || 0,
    todaySpent: todayAgg?.spent || 0,
    txnCount: agg?.txnCount || 0,
    needsReview: agg?.needsReview || 0,
  };
}

async function byCategory(userId, monthStr) {
  const p = resolveMonth(monthStr);
  const rows = await Transaction.aggregate([
    { $match: { ...baseMatch(userId, p.start, p.end), isExpense: true, direction: 'debit' } },
    { $group: { _id: '$category', spent: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { spent: -1 } },
  ]);
  return {
    period: p,
    categories: rows.map((r) => ({
      category: r._id,
      label: BY_KEY[r._id]?.label || r._id,
      icon: BY_KEY[r._id]?.icon,
      color: BY_KEY[r._id]?.color,
      spent: r.spent,
      count: r.count,
    })),
  };
}

/** Time series for the analytics screen; buckets in IST. */
async function series(userId, rangeStr, bucketOverride) {
  const r = resolveRange(rangeStr);
  const bucket = bucketOverride || r.bucket;
  const fmt = { hour: '%Y-%m-%dT%H', day: '%Y-%m-%d', week: '%G-W%V', month: '%Y-%m' }[bucket] || '%Y-%m-%d';

  const rows = await Transaction.aggregate([
    { $match: { ...baseMatch(userId, r.start, r.end), isExpense: true, direction: 'debit' } },
    {
      $group: {
        _id: { bucket: { $dateToString: { format: fmt, date: '$occurredAt', timezone: ZONE } }, category: '$category' },
        spent: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.bucket': 1 } },
  ]);

  const buckets = new Map();
  for (const row of rows) {
    const k = row._id.bucket;
    if (!buckets.has(k)) buckets.set(k, { bucket: k, total: 0, byCategory: {} });
    const b = buckets.get(k);
    b.total += row.spent;
    b.byCategory[row._id.category] = row.spent;
  }
  return { range: r.range, bucket, points: [...buckets.values()] };
}

/** Months that actually have data, so the switcher can't page into an empty 2019. */
async function availableMonths(userId) {
  const rows = await Transaction.aggregate([
    { $match: { userId, deletedAt: null } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$occurredAt', timezone: ZONE } }, count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
  ]);
  const current = resolveMonth().month;
  const months = rows.map((r) => ({ month: r._id, count: r.count }));
  if (!months.find((m) => m.month === current)) months.unshift({ month: current, count: 0 });
  return months.map((m) => ({ ...m, ...resolveMonth(m.month) }));
}

module.exports = { monthSummary, byCategory, series, availableMonths, CATEGORIES };
