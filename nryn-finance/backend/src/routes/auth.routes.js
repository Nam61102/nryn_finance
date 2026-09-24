'use strict';
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const c = require('../auth/auth.controller');
const { requireAuth } = require('../auth/session.middleware');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.post('/register', limiter, c.register);
router.post('/login', limiter, c.login);
router.get('/me', requireAuth, c.me);
router.patch('/accounts', requireAuth, c.updateAccounts);

module.exports = router;
