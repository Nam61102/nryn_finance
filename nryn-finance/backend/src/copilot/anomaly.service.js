'use strict';
const Transaction = require('../db/models/Transaction');

/**
 * Anomaly & Fraud Watchdog Service
 */
async function detectAnomalies(userId) {
  const anomalies = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  // Fetch recent debit transactions
  const txns = await Transaction.find({
    userId,
    direction: 'debit',
    occurredAt: { $gte: thirtyDaysAgo }
  }).sort({ occurredAt: -1 }).limit(100).lean();

  if (!txns || txns.length === 0) {
    return { ok: true, count: 0, anomalies: [] };
  }

  // ── 1. Double Debit Detection ──
  // Check pairs within 10 minutes with same amount & merchant
  for (let i = 0; i < txns.length; i++) {
    for (let j = i + 1; j < txns.length; j++) {
      const t1 = txns[i];
      const t2 = txns[j];

      const timeDiffMinutes = Math.abs(new Date(t1.occurredAt) - new Date(t2.occurredAt)) / (60 * 1000);
      if (timeDiffMinutes <= 10 && t1.amount === t2.amount && t1.amount > 0) {
        const m1 = (t1.merchantName || t1.merchantRaw || '').toLowerCase();
        const m2 = (t2.merchantName || t2.merchantRaw || '').toLowerCase();

        if (m1 === m2 || m1.includes(m2) || m2.includes(m1)) {
          anomalies.push({
            id: `anom_double_${t1._id}_${t2._id}`,
            type: 'double_debit',
            severity: 'high',
            title: 'Possible Double Debit Detected',
            description: `Two identical charges of ₹${(t1.amount / 100).toLocaleString('en-IN')} to "${t1.merchantName || 'Merchant'}" within ${Math.round(timeDiffMinutes)} minutes on ${new Date(t1.occurredAt).toLocaleDateString('en-IN')}.`,
            amountINR: t1.amount / 100,
            merchantName: t1.merchantName || 'Merchant',
            transactions: [t1._id, t2._id],
            occurredAt: t1.occurredAt,
            suggestedAction: 'Check your order receipt or report duplicate UPI debit to bank.'
          });
          break; // Avoid multi-matching the same pair
        }
      }
    }
  }

  // ── 2. Bank Charges & Penalty Fee Detection ──
  const feeKeywords = ['charge', 'fee', 'penalty', 'fine', 'mab', 'min bal', 'annual fee', 'bounce', 'interest debit'];
  for (const t of txns) {
    const raw = (t.merchantRaw || t.merchantName || t.note || '').toLowerCase();
    const matchedKeyword = feeKeywords.find(k => raw.includes(k));
    if (matchedKeyword) {
      anomalies.push({
        id: `anom_fee_${t._id}`,
        type: 'bank_charge',
        severity: 'medium',
        title: 'Hidden Bank Charge or Fee Detected',
        description: `Your account was charged ₹${(t.amount / 100).toLocaleString('en-IN')} labeled as "${t.merchantName || raw}".`,
        amountINR: t.amount / 100,
        merchantName: t.merchantName || 'Bank Fee',
        transactions: [t._id],
        occurredAt: t.occurredAt,
        suggestedAction: 'Contact bank to dispute fee or maintain required minimum balance.'
      });
    }
  }

  // ── 3. High Value Spike Outliers (> ₹5,000 for food/grocery/retail) ──
  const outlierCategories = ['food', 'entertainment', 'groceries'];
  for (const t of txns) {
    if (outlierCategories.includes(t.category) && t.amount >= 4000 * 100) {
      anomalies.push({
        id: `anom_spike_${t._id}`,
        type: 'category_spike',
        severity: 'info',
        title: `Unusual ${t.category.toUpperCase()} Outlier`,
        description: `Large transaction of ₹${(t.amount / 100).toLocaleString('en-IN')} at ${t.merchantName || 'Merchant'} is significantly above average.`,
        amountINR: t.amount / 100,
        merchantName: t.merchantName || 'Merchant',
        transactions: [t._id],
        occurredAt: t.occurredAt,
        suggestedAction: 'Tag as split or verify whether this was a group expense.'
      });
    }
  }

  return {
    ok: true,
    count: anomalies.length,
    anomalies: anomalies.slice(0, 10)
  };
}

module.exports = { detectAnomalies };
