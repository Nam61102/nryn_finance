'use strict';
const Device = require('../db/models/Device');
const RawMessage = require('../db/models/RawMessage');
const Transaction = require('../db/models/Transaction');
const { ingestBatch } = require('./ingest.service');
const { drainPending } = require('../parse/parse.service');

const { isConnected } = require('../db/mongo');
const { store, save } = require('../db/fallback.store');

const MAX_BATCH = 200;

async function postSms(req, res) {
  const { deviceId, messages } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages_array_required' });
  if (messages.length > MAX_BATCH) return res.status(413).json({ error: 'batch_too_large', max: MAX_BATCH });

  if (!isConnected()) {
    return res.status(202).json({ accepted: messages.length, duplicates: 0 });
  }

  const result = await ingestBatch({ userId: req.userId, deviceId, source: 'sms', messages });
  drainPending({ limit: 100 }).catch(() => {});
  res.status(202).json(result);
}

/** The phone asks "where was I?" on every open. */
async function getCursor(req, res) {
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error: 'deviceId_required' });

  if (!isConnected()) {
    return res.json({
      deviceId,
      cursor: 0,
      backfillDoneAt: new Date().toISOString(),
    });
  }

  const device = await Device.findOne({ userId: req.userId, deviceId }).lean();
  res.json({
    deviceId,
    cursor: device?.lastSmsDate || 0,
    backfillDoneAt: device?.backfillDoneAt || null,
  });
}

async function markBackfillDone(req, res) {
  const { deviceId } = req.body || {};
  if (!isConnected()) return res.json({ ok: true });
  await Device.updateOne({ userId: req.userId, deviceId }, { $set: { backfillDoneAt: new Date() } }, { upsert: true });
  res.json({ ok: true });
}

/** Ops view — silent ingest death is this system's characteristic failure. */
async function ingestStats(req, res) {
  const [last] = await RawMessage.find({ userId: req.userId }).sort({ receivedAt: -1 }).limit(1).lean();
  const counts = await RawMessage.aggregate([
    { $match: { userId: req.userId } },
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  res.json({
    lastMessageAt: last?.receivedAt || null,
    minutesSinceLastMessage: last ? Math.round((Date.now() - new Date(last.receivedAt)) / 60000) : null,
    byStatus: Object.fromEntries(counts.map((c) => [c._id, c.n])),
  });
}

const Budget = require('../db/models/Budget');

const D = (daysAgo, hour = 13) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 30, 0, 0);
  return d;
};
const fmt = (d) =>
  `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear()).slice(2)}`;

const SPENDS = [
  [0, 'AD-HDFCBK', 420, 'swiggy@ybl', 'upi'],
  [0, 'AD-HDFCBK', 145, 'zepto@ybl', 'upi'],
  [1, 'VK-KOTAKB', 320, 'uber@icici', 'upi'],
  [1, 'AD-HDFCBK', 2399, 'AMAZON RETAIL', 'card'],
  [2, 'JD-SBIUPI', 180, 'BLINKIT', 'upi'],
  [3, 'AD-HDFCBK', 899, 'zomato@ybl', 'upi'],
  [4, 'VM-ICICIB', 1250, 'BIGBASKET', 'upi'],
  [5, 'AD-AXISBK', 649, 'NETFLIX', 'card'],
  [6, 'AD-HDFCBK', 250, 'rapido@ybl', 'upi'],
  [7, 'AD-HDFCBK', 3200, 'DMART', 'card'],
  [8, 'JD-SBIUPI', 99, 'JIO RECHARGE', 'upi'],
  [9, 'VK-KOTAKB', 1599, 'MYNTRA', 'card'],
  [11, 'AD-HDFCBK', 540, 'swiggy@ybl', 'upi'],
  [12, 'VM-ICICIB', 780, 'APOLLO PHARMACY', 'card'],
  [14, 'AD-HDFCBK', 2100, 'INDIGO', 'card'],
  [16, 'JD-SBIUPI', 360, 'ola@ybl', 'upi'],
  [18, 'AD-HDFCBK', 1450, 'BLINKIT', 'upi'],
  [20, 'AD-AXISBK', 499, 'SPOTIFY', 'card'],
  [22, 'AD-HDFCBK', 675, 'dominos@ybl', 'upi'],
  [24, 'VM-ICICIB', 2800, 'CROMA', 'card'],
];

const NON_EXPENSE = [
  [10, 'AD-HDFCBK', 'Rs.24,500.00 debited from a/c XX1234 towards Credit Card Bill payment for card ending 4455 on {d}. Ref 771122334455.'],
  [5, 'AD-HDFCBK', 'Rs.10,000.00 debited from a/c XX1234 for SIP in Parag Parikh Flexi Cap Fund folio 88231 on {d}.'],
  [3, 'AD-AXISBK', 'Your txn of Rs.5000 on card XX4455 was DECLINED due to insufficient balance on {d}.'],
];

async function seedDemo(req, res) {
  try {
    const userId = req.userId;
    let n = 0;
    const push = async (date, sender, body) => {
      await RawMessage.create({
        userId,
        source: 'sms',
        sourceId: `demo-${userId}-${Date.now()}-${n++}`,
        sender,
        body,
        receivedAt: date,
        status: 'pending',
      }).catch((e) => {
        if (e.code !== 11000) throw e;
      });
    };

    for (const [days, sender, rupees, merchant, method] of SPENDS) {
      const d = D(days, 9 + (days % 12));
      const ref = String(100000000000 + Math.floor(Math.random() * 8e11));
      const body =
        method === 'upi'
          ? `Rs.${rupees.toFixed(2)} debited from a/c XX1234 on ${fmt(d)} to VPA ${merchant}. Ref ${ref}. Not you? Call 18002586161.`
          : `Spent Card no. XX4455 INR ${rupees} ${fmt(d)} ${merchant} Avl Lmt INR 87601. Not you? SMS BLOCK 4455`;
      await push(d, sender, body);
    }

    for (const [days, sender, tpl] of NON_EXPENSE) {
      const d = D(days, 11);
      await push(d, sender, tpl.replace('{d}', fmt(d)));
    }

    // Salary credit
    const sal = D(new Date().getDate() - 1, 10);
    await push(
      sal,
      'AD-HDFCBK',
      `Rs.85,000.00 credited to a/c XX1234 on ${fmt(sal)} by NEFT from KINDERSPORTS LLP. Avl bal Rs 1,02,340.55`
    );

    // (removed) Never create budgets automatically — budgets are user-set only.

    const parsed = await drainPending({ limit: 500 });
    res.json({ ok: true, queued: n, parsed });
  } catch (err) {
    console.error('seedDemo error', err);
    res.status(500).json({ error: 'seed_demo_failed', message: err.message });
  }
}

async function resetData(req, res) {
  try {
    const userId = req.userId;
    const tx = await Transaction.deleteMany({ userId });
    const raw = await RawMessage.deleteMany({ userId });
    // Remove auto-created budgets and the AI's per-user category guesses so nothing fake survives a reset.
    const budgets = await Budget.deleteMany({ userId });
    await require('../db/models/Merchant').deleteMany({ userId, source: 'llm' });
    await Device.updateMany({ userId }, { $set: { lastSmsDate: 0, backfillDoneAt: null } });
    res.json({
      ok: true,
      deletedTransactions: tx.deletedCount || 0,
      deletedMessages: raw.deletedCount || 0,
      deletedBudgets: budgets.deletedCount || 0,
      message: 'All transactions and SMS data wiped successfully.',
    });
  } catch (err) {
    console.error('resetData error', err);
    res.status(500).json({ error: 'reset_failed', message: err.message });
  }
}

async function pasteSms(req, res) {
  try {
    const { text, sender } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text_required', message: 'SMS text is required' });
    }

    const chunks = text
      .split(/(?:\r?\n\s*\r?\n)+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!chunks.length) {
      return res.status(400).json({ error: 'empty_text', message: 'No valid SMS content found' });
    }

    const messages = chunks.map((body, idx) => ({
      smsId: `paste-${Date.now()}-${idx}`,
      sender: sender || 'BANK-SMS',
      body,
      receivedAt: Date.now(),
    }));

    const result = await ingestBatch({ userId: req.userId, source: 'sms', messages });
    const drainStats = await drainPending({ limit: 100 });

    const recentTxns = await Transaction.find({ userId: req.userId, deletedAt: null })
      .sort({ occurredAt: -1, createdAt: -1 })
      .limit(Math.max(messages.length, 10))
      .lean();

    res.json({
      ok: true,
      accepted: result.accepted,
      duplicates: result.duplicates,
      rejected: result.rejected,
      parsed: drainStats,
      transactions: recentTxns,
    });
  } catch (err) {
    console.error('pasteSms error', err);
    res.status(500).json({ error: 'paste_failed', message: err.message });
  }
}

module.exports = { postSms, getCursor, markBackfillDone, ingestStats, seedDemo, resetData, pasteSms };
