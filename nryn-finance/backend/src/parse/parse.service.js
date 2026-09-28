'use strict';
const RawMessage = require('../db/models/RawMessage');
const Transaction = require('../db/models/Transaction');
const User = require('../db/models/User');
const N = require('./normalize');
const { runPatterns } = require('./patterns');
const { bankFor } = require('./senders');
const { extractWithLLM } = require('../ai/extract.service');
const { categorize } = require('../ai/categorize.service');
const { findDuplicate, mergeOverManual } = require('../finance/transaction.repo');
const { iconFor } = require('../shared/categories');

/** Belt-and-braces server-side OTP re-check (§9). Should never fire — the
 *  phone filter already dropped these — but if it does, we refuse to store it. */
const STRICT_OTP_RE = /(?:is\s+(?:your\s+|the\s+)?otp\b|\botp\s+(?:is|to\s+approve|to\s+complete)\b|\buse\s+otp\b|\bvalid\s+for\s+\d+\s*min|\bexpires\s+in\s+\d+\s*min)/i;
const CONFIRMED_TXN_RE = /\b(?:debited|credited|spent|withdrawn|sent\s+(?:rs|inr|₹)|paid\s+(?:rs|inr|₹|to)|transfer(?:red)?\s+to|purchase\s+of)\b/i;

function isOtpMessage(body) {
  if (!body) return false;
  if (STRICT_OTP_RE.test(body)) return true;
  if (!CONFIRMED_TXN_RE.test(body) && /\b(?:otp|one[ -]?time password)\b/i.test(body)) return true;
  return false;
}

/**
 * Parse one raw message into a transaction.
 * regex first → LLM only on a miss → normalize → dedupe → categorize → write.
 */
async function parseRawMessage(raw, { user } = {}) {
  if (isOtpMessage(raw.body)) {
    await RawMessage.updateOne({ _id: raw._id }, { $set: { status: 'ignored', failureReason: 'otp_detected' } });
    return { status: 'ignored', reason: 'otp_detected' };
  }

  const ctx = { sender: raw.sender, receivedAt: raw.receivedAt, source: raw.source };

  // 1 — deterministic pass. Bank SMS are DLT-templated, so this should carry
  //     ~90% of traffic at zero cost and zero latency.
  let hit = runPatterns(raw.body, ctx);

  // 2 — LLM fallback, misses only.
  if (!hit) {
    try {
      hit = await extractWithLLM(raw.body, ctx);
    } catch (err) {
      if (err.code !== 'LLM_DISABLED') console.warn(`  parse   llm extract failed: ${err.message}`);
    }
  }

  if (!hit) {
    await RawMessage.updateOne(
      { _id: raw._id },
      { $set: { status: 'failed', failureReason: 'no_parser_match' }, $inc: { parseAttempts: 1 } },
    );
    return { status: 'failed', reason: 'no_parser_match' };
  }

  // 3 — normalize + the isExpense rules.
  const merchantName = N.cleanMerchant(hit.merchantRaw);
  const mKey = N.merchantKey(merchantName || hit.merchantRaw);
  const verdict = N.classify({ body: raw.body, direction: hit.direction, merchantKey: mKey, user });

  if (verdict.drop) {
    await RawMessage.updateOne({ _id: raw._id }, { $set: { status: 'ignored', failureReason: verdict.reason } });
    return { status: 'ignored', reason: verdict.reason };
  }

  // 4 — dedupe.
  const dup = await findDuplicate({
    userId: raw.userId,
    refId: hit.refId,
    amount: hit.amount,
    direction: hit.direction,
    occurredAt: hit.occurredAt,
    last4: hit.last4,
    source: raw.source,
  });

  if (dup.duplicate && dup.existing.source !== 'manual') {
    // Keep whichever parse we trust more.
    if ((hit.confidence || 0) > (dup.existing.parseConfidence || 0)) {
      dup.existing.parseConfidence = hit.confidence;
      if (hit.refId && !dup.existing.refId) dup.existing.refId = hit.refId;
      await dup.existing.save();
    }
    await RawMessage.updateOne(
      { _id: raw._id },
      { $set: { status: 'parsed', parserUsed: hit.parserUsed, transactionId: dup.existing._id, failureReason: `duplicate:${dup.rule}` } },
    );
    return { status: 'duplicate', rule: dup.rule, transactionId: dup.existing._id };
  }

  // 5 — categorize (skipped when the isExpense rules already decided).
  let cat;
  if (verdict.category) {
    cat = { category: verdict.category, icon: iconFor(verdict.category), source: 'rule', confidence: 1, needsReview: false };
  } else if (hit.direction === 'credit') {
    cat = { category: 'income', icon: iconFor('income'), source: 'rule', confidence: 0.8, needsReview: false };
  } else {
    cat = await categorize({ userId: raw.userId, merchantName, merchantRaw: hit.merchantRaw, amount: hit.amount, method: hit.method });
  }

  // A low-confidence parse is flagged, never guessed. A wrong number in a
  // finance app is worse than a missing one.
  const needsReview = Boolean(cat.needsReview) || (hit.confidence || 0) < 0.7;

  const doc = await Transaction.create({
    userId: raw.userId,
    source: raw.source,
    amount: hit.amount,
    direction: hit.direction,
    occurredAt: hit.occurredAt,
    merchantRaw: hit.merchantRaw,
    merchantName: cat.displayName || merchantName,
    merchantIcon: cat.icon,
    category: cat.category,
    categorySource: cat.source,
    categoryConfidence: cat.confidence,
    account: {
      bankName: hit.bankName || bankFor(raw.sender),
      last4: hit.last4,
      type: hit.accountType || 'savings',
    },
    method: hit.method,
    refId: hit.refId || undefined,
    isExpense: verdict.isExpense,
    balanceAfter: hit.balanceAfter,
    rawMessageId: raw._id,
    parseConfidence: hit.confidence,
    needsReview,
  });

  // Rule 4: this spend may already exist as a manual entry the user typed.
  if (dup.duplicate && dup.existing.source === 'manual') {
    await mergeOverManual(doc, dup.existing);
  }

  await RawMessage.updateOne(
    { _id: raw._id },
    { $set: { status: 'parsed', parserUsed: hit.parserUsed, transactionId: doc._id, failureReason: null } },
  );

  return { status: 'parsed', transaction: doc, parserUsed: hit.parserUsed };
}

/** Drain pending raw messages. Called by parse.job every 30s. */
async function drainPending({ limit = 100 } = {}) {
  const pending = await RawMessage.find({ status: 'pending', parseAttempts: { $lt: 3 } })
    .sort({ receivedAt: 1 })
    .limit(limit);
  if (!pending.length) return { processed: 0 };

  const userCache = new Map();
  const stats = { processed: 0, parsed: 0, duplicate: 0, ignored: 0, failed: 0 };

  for (const raw of pending) {
    const uid = String(raw.userId);
    if (!userCache.has(uid)) userCache.set(uid, await User.findById(raw.userId).lean());
    try {
      const res = await parseRawMessage(raw, { user: userCache.get(uid) });
      stats[res.status] = (stats[res.status] || 0) + 1;
    } catch (err) {
      console.error(`  parse   ${raw._id} threw: ${err.message}`);
      await RawMessage.updateOne({ _id: raw._id }, { $set: { status: 'failed', failureReason: err.message }, $inc: { parseAttempts: 1 } });
      stats.failed++;
    }
    stats.processed++;
  }
  return stats;
}

module.exports = { parseRawMessage, drainPending };
