'use strict';
const { drainPending } = require('../parse/parse.service');
const Transaction = require('../db/models/Transaction');
const { checkBreaches } = require('../finance/budget.service');
const { resolveMonth } = require('../finance/period');

let running = false;

/** Drains pending raw messages every 30s. Never overlaps with itself. */
function startParseJob(io, intervalMs = 30000) {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const before = Date.now();
      const stats = await drainPending({ limit: 100 });
      if (stats.processed) {
        console.log(`  parse   drained ${stats.processed} in ${Date.now() - before}ms`, stats);

        // Push the new rows to any connected phone, then re-check budgets.
        const fresh = await Transaction.find({ createdAt: { $gte: new Date(before) } }).lean();
        const users = new Set();
        for (const t of fresh) {
          io?.to(`user:${t.userId}`).emit('txn:new', t);
          users.add(String(t.userId));
        }
        for (const uid of users) {
          await checkBreaches(uid, resolveMonth().month, io).catch(() => {});
        }
      }
    } catch (err) {
      console.error('  parse   job error:', err.message);
    } finally {
      running = false;
    }
  };
  tick();
  return setInterval(tick, intervalMs);
}

module.exports = { startParseJob };
