'use strict';
const { Schema, model } = require('mongoose');

const AccountSchema = new Schema({
  bankName: String,
  last4: String,
  type: { type: String, enum: ['savings', 'credit_card', 'wallet'], default: 'savings' },
  nickname: String,
}, { _id: false });

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: String,
  // Used by the self-transfer rule (§6.2): a debit to one of your own
  // accounts / UPI handles is a move, not a spend.
  accounts: { type: [AccountSchema], default: [] },
  upiHandles: { type: [String], default: [] },
  gmail: {
    connected: { type: Boolean, default: false },
    email: String,
    refreshToken: String,
    lastSyncAt: Date,
  },
}, { timestamps: true, collection: 'fin_users' });

module.exports = model('User', UserSchema);
