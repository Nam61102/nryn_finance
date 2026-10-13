'use strict';
const { DateTime } = require('luxon');
const Transaction = require('../db/models/Transaction');
const { ZONE } = require('../finance/period');

const SUBSCRIPTION_PATTERNS = [
  { name: 'Netflix', match: /netflix/i, url: 'https://www.netflix.com/youraccount', category: 'entertainment' },
  { name: 'Disney+ Hotstar', match: /hotstar/i, url: 'https://www.hotstar.com/in/my-account', category: 'entertainment' },
  { name: 'Amazon Prime', match: /prime\s*(?:video|retail)?/i, url: 'https://www.amazon.in/mc', category: 'entertainment' },
  { name: 'Spotify Premium', match: /spotify/i, url: 'https://www.spotify.com/account', category: 'entertainment' },
  { name: 'YouTube Premium', match: /youtube(?:\s*premium)?/i, url: 'https://www.youtube.com/paid_memberships', category: 'entertainment' },
  { name: 'Apple Services (iCloud / Music)', match: /apple\.com|itunes/i, url: 'https://support.apple.com/billing', category: 'bills' },
  { name: 'Google One / Drive', match: /google(?:\s*cloud|\s*storage|\s*one)/i, url: 'https://one.google.com', category: 'bills' },
  { name: 'Cult.fit / Gym Membership', match: /cult\.fit|curefit|fitness|gym/i, url: 'https://www.cult.fit', category: 'health' },
  { name: 'Airtel Broadband / Postpaid', match: /airtel(?:\s*broadband|\s*postpaid|\s*fibernet)?/i, url: 'https://www.airtel.in', category: 'bills' },
  { name: 'JioFiber / Postpaid', match: /jio(?:\s*fiber|\s*infocomm)?/i, url: 'https://www.jio.com', category: 'bills' },
];

async function detectSubscriptions(userId) {
  const ninetyDaysAgo = DateTime.now().setZone(ZONE).minus({ days: 90 }).startOf('day').toJSDate();

  const txns = await Transaction.find({
    userId,
    direction: 'debit',
    deletedAt: null,
    occurredAt: { $gte: ninetyDaysAgo },
  }).sort({ occurredAt: -1 }).lean();

  if (!txns || txns.length === 0) {
    return {
      ok: true,
      count: 0,
      empty: true,
      totalMonthlyRecurringPaise: 0,
      totalMonthlyRecurringINR: 0,
      totalAnnualCostPaise: 0,
      totalAnnualCostINR: 0,
      potentialAnnualSavingsPaise: 0,
      potentialAnnualSavingsINR: 0,
      subscriptions: [],
      zombieSubscriptions: [],
    };
  }

  // Group matched txns by pattern
  const matchedGroups = new Map();

  for (const t of txns) {
    const raw = `${t.merchantName || ''} ${t.merchantRaw || ''} ${t.note || ''}`.toLowerCase();

    for (const pattern of SUBSCRIPTION_PATTERNS) {
      if (pattern.match.test(raw)) {
        if (!matchedGroups.has(pattern.name)) {
          matchedGroups.set(pattern.name, {
            pattern,
            txns: [],
          });
        }
        matchedGroups.get(pattern.name).txns.push(t);
        break; // Match one pattern per transaction
      }
    }
  }

  const subscriptions = [];
  const categoryCounts = {};

  for (const [name, group] of matchedGroups.entries()) {
    const groupTxns = group.txns.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    if (groupTxns.length < 2) continue;

    // A subscription is "recurring" only if charged in at least 2 different months within the last 90 days with similar amount (±15%)
    const latestTxn = groupTxns[0];
    const latestAmount = latestTxn.amount;
    if (!latestAmount || latestAmount <= 0) continue;

    const latestMonth = DateTime.fromJSDate(new Date(latestTxn.occurredAt)).setZone(ZONE).toFormat('yyyy-MM');
    const minAmount = latestAmount * 0.85;
    const maxAmount = latestAmount * 1.15;

    const qualifyingOtherMonths = new Set();
    const similarTxns = [latestTxn];

    for (let i = 1; i < groupTxns.length; i++) {
      const other = groupTxns[i];
      if (other.amount >= minAmount && other.amount <= maxAmount) {
        similarTxns.push(other);
        const otherMonth = DateTime.fromJSDate(new Date(other.occurredAt)).setZone(ZONE).toFormat('yyyy-MM');
        if (otherMonth !== latestMonth) {
          qualifyingOtherMonths.add(otherMonth);
        }
      }
    }

    if (qualifyingOtherMonths.size === 0) {
      // Not charged in 2 different months
      continue;
    }

    // Compute actual gap in days between charges
    const prevTxn = similarTxns[1];
    const gapMs = Math.abs(new Date(latestTxn.occurredAt).getTime() - new Date(prevTxn.occurredAt).getTime());
    const gapDays = Math.max(1, Math.round(gapMs / 86400000));

    let frequency = 'monthly';
    if (gapDays >= 75 && gapDays <= 105) frequency = 'quarterly';
    else if (gapDays >= 340 && gapDays <= 380) frequency = 'yearly';

    const renewalDate = DateTime.fromJSDate(new Date(latestTxn.occurredAt)).setZone(ZONE).plus({ days: gapDays });

    // Zombie check: ONLY real signals (price increase or duplicate services in same category)
    let isZombie = false;
    let zombieReason = null;

    if (latestAmount > prevTxn.amount * 1.05) {
      isZombie = true;
      zombieReason = `Price increased from ₹${Math.round(prevTxn.amount / 100)} to ₹${Math.round(latestAmount / 100)}`;
    } else {
      const cat = group.pattern.category;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      if (categoryCounts[cat] > 1) {
        isZombie = true;
        zombieReason = `Multiple active ${cat} subscriptions detected`;
      }
    }

    subscriptions.push({
      id: `sub_${name.replace(/\s+/g, '_').toLowerCase()}`,
      name,
      merchantName: name,
      category: group.pattern.category,
      frequency,
      amountPaise: latestAmount,
      amountINR: Math.round(latestAmount / 100),
      lastChargedAt: latestTxn.occurredAt,
      nextRenewalAt: renewalDate.toISO(),
      isZombie,
      zombieReason,
      cancellationUrl: group.pattern.url,
      occurrences: similarTxns.length,
    });
  }

  if (subscriptions.length === 0) {
    return {
      ok: true,
      count: 0,
      empty: true,
      totalMonthlyRecurringPaise: 0,
      totalMonthlyRecurringINR: 0,
      totalAnnualCostPaise: 0,
      totalAnnualCostINR: 0,
      potentialAnnualSavingsPaise: 0,
      potentialAnnualSavingsINR: 0,
      subscriptions: [],
      zombieSubscriptions: [],
    };
  }

  const totalMonthlyRecurringPaise = subscriptions.reduce((sum, s) => {
    if (s.frequency === 'quarterly') return sum + Math.round(s.amountPaise / 3);
    if (s.frequency === 'yearly') return sum + Math.round(s.amountPaise / 12);
    return sum + s.amountPaise;
  }, 0);
  const totalAnnualCostPaise = totalMonthlyRecurringPaise * 12;

  const zombieSubs = subscriptions.filter((s) => s.isZombie);
  const potentialAnnualSavingsPaise = zombieSubs.reduce((sum, s) => {
    if (s.frequency === 'quarterly') return sum + Math.round(s.amountPaise / 3) * 12;
    if (s.frequency === 'yearly') return sum + s.amountPaise;
    return sum + s.amountPaise * 12;
  }, 0);

  return {
    ok: true,
    count: subscriptions.length,
    empty: false,
    totalMonthlyRecurringPaise,
    totalMonthlyRecurringINR: Math.round(totalMonthlyRecurringPaise / 100),
    totalAnnualCostPaise,
    totalAnnualCostINR: Math.round(totalAnnualCostPaise / 100),
    potentialAnnualSavingsPaise,
    potentialAnnualSavingsINR: Math.round(potentialAnnualSavingsPaise / 100),
    subscriptions,
  };
}

module.exports = { detectSubscriptions };
