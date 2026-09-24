'use strict';
const { Schema, model, Types } = require('mongoose');
const { CATEGORY_KEYS } = require('../../shared/categories');

/**
 * The whole intelligence of the feature (§6.3/§6.4): correct a category once
 * and it is right forever. Also where the per-merchant icon lives.
 */
const MerchantSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', index: true }, // null = global seed row
  key: { type: String, required: true },      // normalized: 'swiggy'
  displayName: String,                        // 'Swiggy'
  category: { type: String, enum: CATEGORY_KEYS, default: 'other' },
  icon: String,                               // emoji; falls back to the category icon
  source: { type: String, enum: ['seed', 'llm', 'user'], default: 'seed' },
  txnCount: { type: Number, default: 0 },
  lastSeenAt: Date,
}, { timestamps: true, collection: 'fin_merchants' });

MerchantSchema.index({ userId: 1, key: 1 }, { unique: true });

module.exports = model('Merchant', MerchantSchema);
