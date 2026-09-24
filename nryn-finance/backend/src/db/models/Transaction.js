'use strict';
const { Schema, model, Types } = require('mongoose');
const { CATEGORY_KEYS } = require('../../shared/categories');

const TransactionSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  source: { type: String, enum: ['sms', 'gmail', 'manual'], required: true },

  // ── Money is integer PAISE and always positive (§6.1). Direction carries
  //    the sign. Only the UI divides by 100.
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR' },
  direction: { type: String, enum: ['debit', 'credit'], required: true },

  occurredAt: { type: Date, required: true },   // from the text when stated, else receivedAt

  merchantRaw: String,        // 'SWIGGY*ORDER' exactly as the bank wrote it
  merchantName: String,       // 'Swiggy'
  merchantIcon: String,       // denormalized so the list renders from one query

  category: { type: String, enum: CATEGORY_KEYS, default: 'other' },
  categorySource: { type: String, enum: ['rule', 'memory', 'llm', 'user'], default: 'rule' },
  categoryConfidence: { type: Number, default: 0 },

  account: {
    bankName: String,
    last4: String,
    type: { type: String, enum: ['savings', 'credit_card', 'wallet'], default: 'savings' },
  },
  method: {
    type: String,
    enum: ['upi', 'card', 'netbanking', 'atm', 'imps', 'neft', 'auto_debit', 'manual', 'unknown'],
    default: 'unknown',
  },

  refId: String,              // UPI ref / txn id — the cross-source dedupe key

  // §6.2 — a debit is NOT always an expense. Self-transfers, card bill
  // payments, SIPs and refunds all have isExpense:false.
  isExpense: { type: Boolean, default: true, index: true },
  isRecurring: { type: Boolean, default: false },
  note: String,               // manual entries

  balanceAfter: Number,       // paise, when the message states it
  rawMessageId: { type: Types.ObjectId, ref: 'RawMessage' },
  parseConfidence: { type: Number, default: 1 },
  needsReview: { type: Boolean, default: false },

  // Anything listed here survives a replay (§5.4) — never clobber a human.
  userEdited: {
    amount: Boolean,
    category: Boolean,
    merchantName: Boolean,
    isExpense: Boolean,
  },

  deletedAt: Date,            // soft delete
}, { timestamps: true, collection: 'fin_transactions' });

TransactionSchema.index({ userId: 1, occurredAt: -1 });
TransactionSchema.index({ userId: 1, refId: 1 }, { unique: true, sparse: true });
TransactionSchema.index({ userId: 1, category: 1, occurredAt: -1 });
TransactionSchema.index({ userId: 1, needsReview: 1 });
// Backs the "Highest" sort within a month without a full scan.
TransactionSchema.index({ userId: 1, isExpense: 1, occurredAt: -1, amount: -1 });

module.exports = model('Transaction', TransactionSchema);
