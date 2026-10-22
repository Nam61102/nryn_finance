'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../db/models/User');
const env = require('../config/env');
const { isConnected } = require('../db/mongo');
const { store, save } = require('../db/fallback.store');

const sign = (user) =>
  jwt.sign(
    { sub: String(user._id || user.id), email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

async function register(req, res) {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password || String(password).length < 8) {
      return res.status(400).json({
        error: 'email_and_8char_password_required',
        message: 'Email and password (min 8 chars) are required.',
      });
    }
    const cleanEmail = String(email).toLowerCase().trim();

    if (isConnected()) {
      const exists = await User.findOne({ email: cleanEmail });
      if (exists) {
        return res.status(409).json({
          error: 'email_taken',
          message: 'An account with this email already exists. Please sign in.',
        });
      }

      const user = await User.create({
        email: cleanEmail,
        passwordHash: await bcrypt.hash(password, 10),
        name: name ? String(name).trim() : undefined,
      });
      return res.status(201).json({
        token: sign(user),
        user: { id: user._id, email: user.email, name: user.name },
      });
    }

    // Resilient fallback storage when MongoDB Atlas is connecting/authenticating
    console.log('  auth  Registering user in resilient fallback storage for', cleanEmail);
    const existing = store.users.find((u) => u.email === cleanEmail);
    if (existing) {
      return res.status(409).json({
        error: 'email_taken',
        message: 'An account with this email already exists. Please sign in.',
      });
    }
    const newUser = {
      _id: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      email: cleanEmail,
      passwordHash: await bcrypt.hash(password, 10),
      name: name ? String(name).trim() : 'User',
      createdAt: new Date().toISOString(),
    };
    store.users.push(newUser);
    save();

    return res.status(201).json({
      token: sign(newUser),
      user: { id: newUser._id, email: newUser.email, name: newUser.name },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'register_failed', message: err.message || 'Registration failed' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        error: 'email_and_password_required',
        message: 'Email and password are required.',
      });
    }
    const cleanEmail = String(email).toLowerCase().trim();

    if (isConnected()) {
      const user = await User.findOne({ email: cleanEmail });
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

      return res.json({
        token: sign(user),
        user: { id: user._id, email: user.email, name: user.name },
      });
    }

    // Resilient fallback storage when MongoDB Atlas is connecting/authenticating
    console.log('  auth  Logging in user via resilient fallback storage for', cleanEmail);
    const user = store.users.find((u) => u.email === cleanEmail);
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

    return res.json({
      token: sign(user),
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'login_failed', message: err.message || 'Login failed' });
  }
}

async function resetPassword(req, res) {
  try {
    const { email, newPassword } = req.body || {};
    if (!email || !newPassword || String(newPassword).length < 8) {
      return res.status(400).json({
        error: 'email_and_8char_password_required',
        message: 'Email and a new password with at least 8 characters are required.',
      });
    }
    const cleanEmail = String(email).toLowerCase().trim();

    if (isConnected()) {
      const user = await User.findOne({ email: cleanEmail });
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

    const user = store.users.find((u) => u.email === cleanEmail);
    if (!user) {
      return res.status(404).json({
        error: 'user_not_found',
        message: 'No account found with this email address.',
      });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    save();
    return res.json({
      ok: true,
      message: 'Password reset successfully. You can now sign in with your new password.',
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'reset_failed', message: err.message || 'Password reset failed' });
  }
}

async function me(req, res) {
  try {
    if (isConnected()) {
      const user = await User.findById(req.userId).select('-passwordHash -gmail.refreshToken').lean();
      if (!user) return res.status(404).json({ error: 'not_found' });
      return res.json({ user });
    }
    const user = store.users.find((u) => u._id === req.userId);
    if (!user) {
      return res.json({ user: { id: req.userId, email: 'user@nryn.local', name: 'User' } });
    }
    const { passwordHash, ...safeUser } = user;
    return res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
}

async function updateAccounts(req, res) {
  try {
    const { accounts, upiHandles } = req.body || {};
    if (isConnected()) {
      const $set = {};
      if (Array.isArray(accounts)) $set.accounts = accounts;
      if (Array.isArray(upiHandles)) $set.upiHandles = upiHandles;
      const user = await User.findByIdAndUpdate(req.userId, { $set }, { new: true }).select('accounts upiHandles').lean();
      return res.json({ user });
    }
    const user = store.users.find((u) => u._id === req.userId);
    if (user) {
      if (Array.isArray(accounts)) user.accounts = accounts;
      if (Array.isArray(upiHandles)) user.upiHandles = upiHandles;
      save();
    }
    return res.json({ user: { accounts: accounts || [], upiHandles: upiHandles || [] } });
  } catch (err) {
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
}

async function updateTaxRegime(req, res) {
  try {
    const { taxRegime } = req.body || {};
    if (taxRegime !== null && !['new', 'old'].includes(taxRegime)) {
      return res.status(400).json({ error: 'invalid_tax_regime', message: 'taxRegime must be "new", "old", or null' });
    }
    if (isConnected()) {
      const user = await User.findByIdAndUpdate(req.userId, { $set: { taxRegime } }, { new: true }).select('-passwordHash -gmail.refreshToken').lean();
      return res.json({ ok: true, user });
    }
    const user = store.users.find((u) => u._id === req.userId);
    if (user) {
      user.taxRegime = taxRegime;
      save();
    }
    return res.json({ ok: true, user: { taxRegime } });
  } catch (err) {
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
}

module.exports = { register, login, resetPassword, me, updateAccounts, updateTaxRegime };
