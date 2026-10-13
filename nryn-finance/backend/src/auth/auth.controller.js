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
  if (!email || !password) {
    return res.status(400).json({ error: 'email_and_password_required', message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: String(email || '').toLowerCase() });
  if (!user) {
    return res.status(404).json({
      error: 'user_not_found',
      message: 'No account found with this email. Please create an account.',
    });
  }

  const isMatch = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({
      error: 'invalid_credentials',
      message: 'Incorrect password. Please try again or tap "Forgot Password?".',
    });
  }

  res.json({ token: sign(user), user: { id: user._id, email: user.email, name: user.name } });
}

async function resetPassword(req, res) {
  const { email, newPassword } = req.body || {};
  if (!email || !newPassword || String(newPassword).length < 8) {
    return res.status(400).json({
      error: 'email_and_8char_password_required',
      message: 'Email and a new password with at least 8 characters are required.',
    });
  }

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) {
    return res.status(404).json({
      error: 'user_not_found',
      message: 'No account found with this email address.',
    });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  return res.json({
    ok: true,
    message: 'Password reset successfully. You can now sign in with your new password.',
  });
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

async function updateTaxRegime(req, res) {
  const { taxRegime } = req.body || {};
  if (taxRegime !== null && !['new', 'old'].includes(taxRegime)) {
    return res.status(400).json({ error: 'invalid_tax_regime', message: 'taxRegime must be "new", "old", or null' });
  }
  const user = await User.findByIdAndUpdate(req.userId, { $set: { taxRegime } }, { new: true }).select('-passwordHash -gmail.refreshToken').lean();
  res.json({ ok: true, user });
}

module.exports = { register, login, resetPassword, me, updateAccounts, updateTaxRegime };
