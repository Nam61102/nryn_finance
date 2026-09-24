'use strict';
require('dotenv').config();

/**
 * Two-tier env validation (carried over from nryn-mail).
 *   FATAL  — the process must not start without these.
 *   WARN   — the server starts, but routes that need them answer 503
 *            naming the exact missing variable, instead of failing oddly.
 */
const FATAL = ['MONGO_URI', 'JWT_SECRET'];

const missingFatal = FATAL.filter((k) => !process.env[k] || !String(process.env[k]).trim());
if (missingFatal.length) {
  console.error('\n  FATAL: missing required env vars:', missingFatal.join(', '));
  console.error('  Copy .env.example to .env and fill them in.\n');
  process.exit(1);
}

const bool = (v, def = false) => {
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};

const env = {
  port: Number(process.env.PORT || 4200),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  tz: process.env.TZ_APP || 'Asia/Kolkata',
  logLevel: process.env.LOG_LEVEL || 'dev',
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  llm: {
    enabled: bool(process.env.LLM_FALLBACK_ENABLED, false),
    model: process.env.LLM_MODEL || 'openai/gpt-4o-mini',
    openrouterKey: process.env.OPENROUTER_API_KEY || '',
    groqKey: process.env.GROQ_API_KEY || '',
    openaiKey: process.env.OPENAI_API_KEY || '',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  },
};

/** Warn-tier report, printed once at boot and exposed on /api/health. */
env.capabilities = {
  llmFallback: env.llm.enabled && Boolean(env.llm.openrouterKey || env.llm.groqKey || env.llm.openaiKey),
  gmail: Boolean(env.google.clientId && env.google.clientSecret),
};

env.missingFor = (capability) => {
  if (capability === 'llm') {
    if (!env.llm.enabled) return ['LLM_FALLBACK_ENABLED'];
    return ['OPENROUTER_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY'].filter((k) => !process.env[k]);
  }
  if (capability === 'gmail') {
    return ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'].filter((k) => !process.env[k]);
  }
  return [];
};

module.exports = env;
