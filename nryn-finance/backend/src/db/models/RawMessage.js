'use strict';
const { Schema, model, Types } = require('mongoose');

/**
 * Keep every ingested message verbatim, forever (plan §5.1).
 * This is what makes `npm run replay` possible: fix a regex, re-parse history,
 * instead of losing money data permanently.
 * NOTE: manual entries have no raw message — they write straight to Transaction.
 */
const RawMessageSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  deviceId: String,
  source: { type: String, enum: ['sms', 'gmail'], required: true },
  sourceId: { type: String, required: true },   // SMS _id on the phone, or Gmail message id
  sender: String,                                // 'AD-HDFCBK' / 'alerts@hdfcbank.net'
  body: { type: String, required: true },        // raw, digits beyond last4 redacted at parse time
  receivedAt: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'parsed', 'ignored', 'failed'], default: 'pending' },
  parseAttempts: { type: Number, default: 0 },
  parserUsed: String,                            // 'hdfc.upi.debit' | 'llm' | null
  failureReason: String,
  transactionId: { type: Types.ObjectId, ref: 'Transaction' },
}, { timestamps: true, collection: 'fin_raw_messages' });

RawMessageSchema.index({ userId: 1, source: 1, sourceId: 1 }, { unique: true });
RawMessageSchema.index({ status: 1, receivedAt: 1 });

module.exports = model('RawMessage', RawMessageSchema);
