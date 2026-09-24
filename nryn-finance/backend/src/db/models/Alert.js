'use strict';
const { Schema, model, Types } = require('mongoose');

/**
 * Fired once per budget per month (§7A). The fired state lives here, not in
 * memory, so a backend restart does not re-fire every breach.
 */
const AlertSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['budget_80', 'budget_100', 'total_100', 'digest', 'ingest_stale'], required: true },
  scope: { type: String, enum: ['total', 'category'], default: 'total' },
  category: String,
  month: String,                    // 'YYYY-MM'
  title: String,
  body: String,
  data: Schema.Types.Mixed,
  read: { type: Boolean, default: false },
}, { timestamps: true, collection: 'fin_alerts' });

AlertSchema.index({ userId: 1, type: 1, scope: 1, category: 1, month: 1 }, { unique: true, sparse: true });
AlertSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = model('Alert', AlertSchema);
