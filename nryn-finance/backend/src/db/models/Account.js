'use strict';
const { Schema, model, Types } = require('mongoose');

const AccountSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['savings', 'loan', 'credit_card', 'current', 'wallet'],
    required: true,
    default: 'savings'
  },
  bankName: { type: String, required: true },
  accountNumber: { type: String, default: '' },
  accountHolder: { type: String, default: '' },
  balance: { type: Number, default: 0 }, // paise (for savings/current)
  
  // Loan-specific fields
  loanType: {
    type: String,
    enum: ['personal', 'home', 'auto', 'education', 'gold', 'business', 'other', null],
    default: null
  },
  principalAmount: { type: Number, default: 0 }, // paise
  outstandingAmount: { type: Number, default: 0 }, // paise
  emiAmount: { type: Number, default: 0 }, // paise
  interestRate: { type: Number, default: 0 }, // e.g. 8.5%
  emiDueDate: { type: Number, default: 5 }, // day of month (1-31)
  tenureMonths: { type: Number, default: 0 },
  
  documentUrl: { type: String, default: '' },
  documentName: { type: String, default: '' },
  aiExtracted: { type: Boolean, default: false },
  notes: { type: String, default: '' }
}, { timestamps: true, collection: 'fin_accounts' });

AccountSchema.index({ userId: 1, type: 1 });

module.exports = model('Account', AccountSchema);
