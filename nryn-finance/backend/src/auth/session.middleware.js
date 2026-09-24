'use strict';
const jwt = require('jsonwebtoken');
const { Types } = require('mongoose');
const env = require('../config/env');

/** Bearer-first (nryn-mail pattern), with a cookie fallback for the web. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.userId = new Types.ObjectId(payload.sub);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

/** Warn-tier gate: the route answers 503 naming the exact missing variable. */
const requireCapability = (cap) => (req, res, next) => {
  if (env.capabilities[cap]) return next();
  return res.status(503).json({ error: 'capability_unavailable', capability: cap, missing: env.missingFor(cap === 'llmFallback' ? 'llm' : cap) });
};

module.exports = { requireAuth, requireCapability };
