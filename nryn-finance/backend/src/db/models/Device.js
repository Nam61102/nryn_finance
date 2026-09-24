'use strict';
const { Schema, model, Types } = require('mongoose');

/** One row per phone. Holds the SMS sync cursor (§3.2). */
const DeviceSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  deviceId: { type: String, required: true },
  platform: { type: String, default: 'android' },
  model: String,
  // Epoch millis of the newest SMS the SERVER has acknowledged.
  // Advanced only after a successful ingest — never on a failed upload.
  lastSmsDate: { type: Number, default: 0 },
  backfillDoneAt: Date,
  lastSeenAt: Date,
}, { timestamps: true, collection: 'fin_devices' });

DeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

module.exports = model('Device', DeviceSchema);
