'use strict';
const Device = require('../db/models/Device');
const RawMessage = require('../db/models/RawMessage');
const { ingestBatch } = require('./ingest.service');

const MAX_BATCH = 200;

async function postSms(req, res) {
  const { deviceId, messages } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages_array_required' });
  if (messages.length > MAX_BATCH) return res.status(413).json({ error: 'batch_too_large', max: MAX_BATCH });

  const result = await ingestBatch({ userId: req.userId, deviceId, source: 'sms', messages });
  res.status(202).json(result);
}

/** The phone asks "where was I?" on every open. */
async function getCursor(req, res) {
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error: 'deviceId_required' });
  const device = await Device.findOne({ userId: req.userId, deviceId }).lean();
  res.json({
    deviceId,
    cursor: device?.lastSmsDate || 0,
    backfillDoneAt: device?.backfillDoneAt || null,
  });
}

async function markBackfillDone(req, res) {
  const { deviceId } = req.body || {};
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

module.exports = { postSms, getCursor, markBackfillDone, ingestStats };
