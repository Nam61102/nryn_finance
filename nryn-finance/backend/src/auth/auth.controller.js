'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../db/models/User');
const env = require('../config/env');

const sign = (user) => jwt.sign({ sub: String(user._id), email: user.email }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

async function register(req, res) {
  const { email, password, name } = req.body || {};
  if (!email || !password || String(password).length < 8) {
    return res.status(400).json({ error: 'email_and_8char_password_required' });
  }
  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) return res.status(409).json({ error: 'email_taken' });

  const user = await User.create({
    email: String(email).toLowerCase(),
    passwordHash: await bcrypt.hash(password, 10),
    name,
  });
  res.status(201).json({ token: sign(user), user: { id: user._id, email: user.email, name: user.name } });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: String(email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  res.json({ token: sign(user), user: { id: user._id, email: user.email, name: user.name } });
}

async function me(req, res) {
  const user = await User.findById(req.userId).select('-passwordHash -gmail.refreshToken').lean();
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ user });
}

/** Register your own accounts / UPI handles — this is what powers the
 *  self-transfer exclusion in §6.2. */
async function updateAccounts(req, res) {
  const { accounts, upiHandles } = req.body || {};
  const $set = {};
  if (Array.isArray(accounts)) $set.accounts = accounts;
  if (Array.isArray(upiHandles)) $set.upiHandles = upiHandles;
  const user = await User.findByIdAndUpdate(req.userId, { $set }, { new: true }).select('accounts upiHandles').lean();
  res.json({ user });
}

module.exports = { register, login, me, updateAccounts };
