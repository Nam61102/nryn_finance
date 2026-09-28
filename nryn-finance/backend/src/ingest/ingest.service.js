'use strict';
const RawMessage = require('../db/models/RawMessage');
const Device = require('../db/models/Device');
const N = require('../parse/normalize');

const STRICT_OTP_RE = /(?:is\s+(?:your\s+|the\s+)?otp\b|\botp\s+(?:is|to\s+approve|to\s+complete)\b|\buse\s+otp\b|\bvalid\s+for\s+\d+\s*min|\bexpires\s+in\s+\d+\s*min)/i;
const CONFIRMED_TXN_RE = /\b(?:debited|credited|spent|withdrawn|sent\s+(?:rs|inr|₹)|paid\s+(?:rs|inr|₹|to)|transfer(?:red)?\s+to|purchase\s+of)\b/i;

function isOtpMessage(body) {
  if (!body) return false;
  if (STRICT_OTP_RE.test(body)) return true;
  if (!CONFIRMED_TXN_RE.test(body) && /\b(?:otp|one[ -]?time password)\b/i.test(body)) return true;
  return false;
}

/**
 * Store raw, mark pending. Parsing NEVER happens inside the request — the
 * phone gets a fast 202 and the job drains the queue.
 * Idempotent on {userId, source, sourceId}, so retrying is always safe.
 */
async function ingestBatch({ userId, deviceId, source = 'sms', messages = [] }) {
  let accepted = 0;
  let duplicates = 0;
  let rejected = 0;
  let maxDate = 0;

  for (const msg of messages) {
    const receivedAtMs = Number(msg.receivedAt) || Date.now();
    maxDate = Math.max(maxDate, receivedAtMs);

    // Belt-and-braces: the phone filter already excluded these (§3.3/§9).
    if (!msg.body || isOtpMessage(msg.body)) { rejected++; continue; }

    try {
      await RawMessage.create({
        userId,
        deviceId,
        source,
        sourceId: String(msg.smsId ?? msg.sourceId ?? `${receivedAtMs}-${(msg.body || '').slice(0, 24)}`),
        sender: msg.sender,
        body: N.redact(msg.body),        // redact BEFORE it is written
        receivedAt: new Date(receivedAtMs),
        status: 'pending',
      });
      accepted++;
    } catch (err) {
      if (err.code === 11000) duplicates++;
      else throw err;
    }
  }

  // The cursor advances only here — after the server has the rows.
  let cursor = maxDate;
  if (deviceId) {
    const device = await Device.findOneAndUpdate(
      { userId, deviceId },
      { $max: { lastSmsDate: maxDate }, $set: { lastSeenAt: new Date() }, $setOnInsert: { userId, deviceId } },
      { upsert: true, new: true },
    );
    cursor = device.lastSmsDate;
  }

  return { accepted, duplicates, rejected, cursor };
}

module.exports = { ingestBatch };
