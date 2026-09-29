'use strict';
const { Schema, model, Types } = require('mongoose');

const PolicySchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['health', 'car', 'medical', 'life', 'term', 'two_wheeler', 'travel', 'home', 'other'],
    required: true,
    default: 'health'
  },
  title: { type: String, required: true },
  provider: { type: String, required: true },
  policyNumber: { type: String, default: '' },
  insuredName: { type: String, default: '' },
  sumInsured: { type: Number, default: 0 }, // paise
  premiumAmount: { type: Number, default: 0 }, // paise
  frequency: {
    type: String,
    enum: ['yearly', 'half_yearly', 'quarterly', 'monthly', 'one_time'],
    default: 'yearly'
  },
  startDate: { type: Date, default: null },
  expiryDate: { type: Date, default: null },
  documentUrl: { type: String, default: '' },
  documentName: { type: String, default: '' },
  status: {
    type: String,
    enum: ['active', 'grace_period', 'expired'],
    default: 'active'
  },
  aiExtracted: { type: Boolean, default: false },
  aiConfidence: { type: Number, default: 1.0 },
  notes: { type: String, default: '' }
}, { timestamps: true, collection: 'fin_policies' });

PolicySchema.index({ userId: 1, expiryDate: 1 });

module.exports = model('Policy', PolicySchema);
