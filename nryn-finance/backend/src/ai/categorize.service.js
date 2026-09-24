'use strict';
const Merchant = require('../db/models/Merchant');
const { iconFor, CATEGORY_KEYS } = require('../shared/categories');
const { chatJSON, isEnabled } = require('./llm.client');
const { SYSTEM, user } = require('./prompts/categorize.prompt');
const N = require('../parse/normalize');

/**
 * Resolution order, stop at first hit (§6.3):
 *   1. the user's own merchant memory (their corrections always win)
 *   2. the global seed rules
 *   3. the LLM — and the answer is written back, so it never costs a call again
 *   4. 'other' + needsReview
 */
async function categorize({ userId, merchantName, merchantRaw, amount, method }) {
  const key = N.merchantKey(merchantName || merchantRaw);
  if (!key) return { category: 'other', icon: iconFor('other'), source: 'rule', confidence: 0, needsReview: true };

  // 1 — user memory
  const mine = await Merchant.findOne({ userId, key }).lean();
  if (mine) {
    return { category: mine.category, icon: mine.icon || iconFor(mine.category), source: 'memory', confidence: 1, needsReview: false, displayName: mine.displayName };
  }

  // 2 — global seed
  const seed = await Merchant.findOne({ userId: null, key }).lean();
  if (seed) {
    return { category: seed.category, icon: seed.icon || iconFor(seed.category), source: 'rule', confidence: 0.9, needsReview: false, displayName: seed.displayName };
  }

  // 3 — LLM, with writeback
  if (isEnabled()) {
    try {
      const { json } = await chatJSON(SYSTEM, user({ merchant: merchantName || merchantRaw, amountRupees: N.toRupees(amount), method }));
      const category = CATEGORY_KEYS.includes(json.category) ? json.category : 'other';
      const icon = (json.icon && String(json.icon).slice(0, 4)) || iconFor(category);
      const confidence = typeof json.confidence === 'number' ? json.confidence : 0.5;

      await Merchant.updateOne(
        { userId, key },
        { $setOnInsert: { userId, key, displayName: merchantName || merchantRaw, category, icon, source: 'llm' }, $set: { lastSeenAt: new Date() } },
        { upsert: true },
      );
      return { category, icon, source: 'llm', confidence, needsReview: confidence < 0.7 };
    } catch (err) {
      if (err.code !== 'LLM_DISABLED') console.warn(`  categorize  llm failed: ${err.message}`);
    }
  }

  // 4 — unknown
  return { category: 'other', icon: iconFor('other'), source: 'rule', confidence: 0, needsReview: true };
}

/** Called on a PATCH that changes a category — this is the "learns" part. */
async function rememberCorrection({ userId, merchantName, category, icon }) {
  const key = N.merchantKey(merchantName);
  if (!key) return null;
  await Merchant.updateOne(
    { userId, key },
    { $set: { displayName: merchantName, category, icon: icon || iconFor(category), source: 'user', lastSeenAt: new Date() }, $inc: { txnCount: 1 } },
    { upsert: true },
  );
  return key;
}

module.exports = { categorize, rememberCorrection };
