'use strict';
/**
 * Re-parse stored raw messages after a parser change, and DIFF before writing.
 * This is the entire reason fin_raw_messages exists (§5.4).
 *
 *   node scripts/replay.js --since=2026-09-01 [--sender=HDFCBK] [--dry-run]
 *
 * Never touches manual transactions, and preserves every field the user edited.
 */
require('dotenv').config();
const { connect, mongoose } = require('../src/db/mongo');
const RawMessage = require('../src/db/models/RawMessage');
const Transaction = require('../src/db/models/Transaction');
const User = require('../src/db/models/User');
const { runPatterns } = require('../src/parse/patterns');
const { toRupees } = require('../src/parse/normalize');

const arg = (k, d = null) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split('=')[1] : (process.argv.includes(`--${k}`) ? true : d);
};

(async () => {
  await connect();
  const since = arg('since') ? new Date(arg('since')) : new Date(Date.now() - 30 * 864e5);
  const sender = arg('sender');
  const dry = Boolean(arg('dry-run'));

  const q = { receivedAt: { $gte: since } };
  if (sender) q.sender = new RegExp(sender, 'i');

  const raws = await RawMessage.find(q).sort({ receivedAt: 1 }).lean();
  console.log(`\n  replaying ${raws.length} raw messages since ${since.toISOString().slice(0, 10)}${dry ? '  (DRY RUN)' : ''}\n`);

  const users = new Map();
  let changed = 0; let same = 0; let stillMissing = 0; let skipped = 0;

  for (const raw of raws) {
    const uid = String(raw.userId);
    if (!users.has(uid)) users.set(uid, await User.findById(raw.userId).lean());

    const existing = raw.transactionId ? await Transaction.findById(raw.transactionId).lean() : null;

    // Never clobber a human, and never touch a manual row.
    if (existing?.source === 'manual') { skipped++; continue; }

    const hit = runPatterns(raw.body, { sender: raw.sender, receivedAt: raw.receivedAt, source: raw.source });
    if (!hit) { stillMissing++; continue; }

    if (!existing) {
      console.log(`  + NEW   ${raw.sender}  ₹${toRupees(hit.amount)}  ${hit.direction}  [${hit.parserUsed}]`);
      changed++;
      continue;
    }

    const diffs = [];
    if (existing.amount !== hit.amount && !existing.userEdited?.amount) diffs.push(`amount ₹${toRupees(existing.amount)} → ₹${toRupees(hit.amount)}`);
    if (existing.direction !== hit.direction) diffs.push(`direction ${existing.direction} → ${hit.direction}`);
    if (hit.refId && existing.refId !== hit.refId) diffs.push(`refId ${existing.refId || '∅'} → ${hit.refId}`);

    if (!diffs.length) { same++; continue; }
    console.log(`  ~ DIFF  ${raw.sender}  ${diffs.join(' · ')}`);
    changed++;

    if (!dry) {
      const $set = { parseConfidence: hit.confidence };
      if (!existing.userEdited?.amount) $set.amount = hit.amount;
      if (hit.refId) $set.refId = hit.refId;
      $set.direction = hit.direction;
      await Transaction.updateOne({ _id: existing._id }, { $set });
    }
  }

  console.log(`\n  unchanged ${same} · changed ${changed} · still unparsed ${stillMissing} · skipped (manual) ${skipped}`);
  console.log(dry ? '  DRY RUN — nothing written\n' : '  written\n');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
