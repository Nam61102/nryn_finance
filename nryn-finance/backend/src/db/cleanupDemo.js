'use strict';
const Budget = require('./models/Budget');
const RawMessage = require('./models/RawMessage');
const Transaction = require('./models/Transaction');

/**
 * One-time-safe cleanup of the old "Load Sample Data" feature.
 * That feature wrote fake SMS (sourceId "demo-...") and fake budgets
 * (₹30,000 total, ₹8,000 food, ₹6,000 groceries, ₹4,000 transport,
 * ₹7,000 shopping, ₹2,000 entertainment) into REAL accounts.
 * Runs on every server start; it only touches rows that still match the demo values.
 */
const DEMO_BUDGETS = [
  ['total', null, 3000000],
  ['category', 'food', 800000],
  ['category', 'groceries', 600000],
  ['category', 'transport', 400000],
  ['category', 'shopping', 700000],
  ['category', 'entertainment', 200000],
];

async function cleanupDemoData() {
  // 1. fake SMS + the transactions parsed from them
  const demoRaw = await RawMessage.find({ sourceId: /^demo-/ }).select('_id').lean();
  const ids = demoRaw.map((r) => r._id);
  let tx = { deletedCount: 0 };
  if (ids.length) {
    tx = await Transaction.deleteMany({ rawMessageId: { $in: ids } });
    await RawMessage.deleteMany({ _id: { $in: ids } });
  }

  // 2. fake budgets — only for users who have the demo "food ₹8,000" rolling row,
  //    and only rows whose amount is still exactly the demo amount.
  const demoUsers = await Budget.distinct('userId', { scope: 'category', category: 'food', amount: 800000, month: null });
  let budgetsRemoved = 0;
  for (const userId of demoUsers) {
    for (const [scope, category, amount] of DEMO_BUDGETS) {
      const r = await Budget.deleteMany({ userId, scope, category, amount });
      budgetsRemoved += r.deletedCount || 0;
    }
  }

  if (ids.length || budgetsRemoved) {
    console.log(`  cleanup  removed ${ids.length} demo SMS, ${tx.deletedCount || 0} demo transactions, ${budgetsRemoved} demo budgets`);
  }
}

module.exports = { cleanupDemoData };
