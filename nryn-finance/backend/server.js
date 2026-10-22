'use strict';
const http = require('http');
const express = require('express');

// Ensure all Express async route handlers are safely caught and never trigger unhandledRejection
const Layer = require('express/lib/router/layer');
const origHandle = Layer.prototype.handle_request;
Layer.prototype.handle_request = function (req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return origHandle.apply(this, arguments);
  try {
    const ret = fn(req, res, next);
    if (ret && typeof ret.catch === 'function') {
      ret.catch(next);
    }
  } catch (err) {
    next(err);
  }
};

const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./src/config/env');
const { connect, isConnected, getLastError } = require('./src/db/mongo');
const { attachSocket } = require('./src/realtime/socket');
const { startParseJob } = require('./src/jobs/parse.job');
const { startDigestJob } = require('./src/jobs/digest.job');
const RawMessage = require('./src/db/models/RawMessage');

const cookieParser = require('cookie-parser');

const app = express();

// Trust reverse proxy (Render, Cloudflare) so express-rate-limit and IP handling work safely
app.set('trust proxy', 1);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || !env.corsOrigins.length) return callback(null, true);
      if (
        env.corsOrigins.includes(origin) ||
        /\.netlify\.app$/.test(origin) ||
        /localhost|127\.0\.0\.1/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(cookieParser());

// Allow 10mb only for document analysis and bank statement imports; 1mb globally everywhere else
app.use(['/api/ai/analyze-document', '/api/ai/statement-import'], express.json({ limit: '10mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.logLevel));

/**
 * Health check: reports MongoDB connection status, last message timestamp,
 * and masked config diagnostics.
 */
app.get('/api/health', async (req, res) => {
  let lastMessageAt = null;
  if (isConnected()) {
    try {
      const [last] = await RawMessage.find().sort({ receivedAt: -1 }).limit(1).select('receivedAt').lean();
      lastMessageAt = last?.receivedAt || null;
    } catch { /* mongo down */ }
  }

  // Masked mongoUri for safe diagnostics
  let maskedUri = null;
  let passDiag = null;
  if (env.mongoUri) {
    try {
      const u = new URL(env.mongoUri.replace('mongodb+srv://', 'http://').replace('mongodb://', 'http://'));
      maskedUri = `mongodb+srv://${u.username || 'user'}:****@${u.host}${u.pathname}`;
      const p = u.password || '';
      passDiag = {
        length: p.length,
        hasBrackets: p.startsWith('<') && p.endsWith('>'),
        firstChar: p.length > 0 ? p[0] : null,
        lastChar: p.length > 0 ? p[p.length - 1] : null,
      };
    } catch {
      maskedUri = 'configured';
    }
  }

  res.json({
    ok: isConnected(),
    mongo: isConnected() ? 'connected' : 'disconnected',
    mongoError: getLastError(),
    mongoConfigured: Boolean(env.mongoUri),
    mongoUriMasked: maskedUri,
    mongoPassDiag: passDiag,
    capabilities: env.capabilities,
    missing: { llm: env.missingFor('llm'), gmail: env.missingFor('gmail') },
    lastMessageAt,
    minutesSinceLastMessage: lastMessageAt ? Math.round((Date.now() - new Date(lastMessageAt)) / 60000) : null,
    tz: env.tz,
    uptimeSec: Math.round(process.uptime()),
  });
});

app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/ingest', require('./src/routes/ingest.routes'));
app.use('/api/copilot', require('./src/routes/copilot.routes'));
app.use('/api', require('./src/routes/finance.routes'));

app.use((req, res) => res.status(404).json({ error: 'not_found', path: req.path }));
app.use((err, req, res, _next) => {
  console.error('  error  ', err);
  res.status(err.status || 500).json({ error: err.code || 'internal_error', message: err.message });
});

// Guard against unhandled rejections crashing the process
process.on('unhandledRejection', (reason, promise) => {
  console.error('  unhandledRejection  ', reason);
});
process.on('uncaughtException', (err) => {
  console.error('  uncaughtException  ', err);
});

async function main() {
  const server = http.createServer(app);
  const io = attachSocket(server);
  app.set('io', io);

  server.listen(env.port, () => {
    console.log(`\n  NRYN Finance backend`);
    console.log(`  api     http://localhost:${env.port}/api/health`);
    console.log(`  tz      ${env.tz}`);
    console.log(`  llm     ${env.capabilities.llmFallback ? 'enabled' : 'DISABLED (regex-only — nothing leaves this machine)'}`);
    console.log(`  gmail   ${env.capabilities.gmail ? 'configured' : 'not configured (phase 2)'}\n`);
  });

  try {
    await connect();
    // Remove fake data left behind by the old 'Load Sample Data' button.
    require('./src/db/cleanupDemo').cleanupDemoData().catch((e) => console.warn('  cleanup  failed:', e.message));
    startParseJob(io);
    startDigestJob(io);
  } catch (err) {
    console.error('  MongoDB initial connection failed:', err.message);
    console.log('  Server will stay live on port', env.port, 'and retry connecting in background...');
    const retryTimer = setInterval(async () => {
      try {
        console.log('  Retrying MongoDB connection...');
        await connect();
        console.log('  MongoDB reconnected successfully!');
        clearInterval(retryTimer);
        require('./src/db/cleanupDemo').cleanupDemoData().catch((e) => console.warn('  cleanup  failed:', e.message));
        startParseJob(io);
        startDigestJob(io);
      } catch (retryErr) {
        console.error('  MongoDB retry failed:', retryErr.message);
      }
    }, 15000);
  }
}

main().catch((err) => {
  console.error('  FATAL  ', err);
  process.exit(1);
});
