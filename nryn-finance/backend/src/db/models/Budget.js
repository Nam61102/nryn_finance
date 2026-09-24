'use strict';
const { Schema, model, Types } = require('mongoose');
const { CATEGORY_KEYS } = require('../../shared/categories');

/**
 * Budgets are first-class objects (§7A), not a spend split.
 *   month: null       → the rolling default, applies to every month
 *   month: '2026-04'  → an override for that month only
 * Resolution: month-specific row first, else the rolling one.
 */
const BudgetSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  scope: { type: String, enum: ['total', 'category'], required: true },
  category: { type: String, enum: [...CATEGORY_KEYS, null], default: null },
  amount: { type: Number, required: true, min: 0 },   // paise
  period: { type: String, default: 'monthly' },
  month: { type: String, default: null },             // 'YYYY-MM' or null
  carryOver: { type: Boolean, default: false },       // v1: false
}, { timestamps: true, collection: 'fin_budgets' });

BudgetSchema.index({ userId: 1, month: 1, scope: 1, category: 1 }, { unique: true });

module.exports = model('Budget', BudgetSchema);
