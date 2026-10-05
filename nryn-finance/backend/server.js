'use strict';
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./src/config/env');
const { connect, isConnected } = require('./src/db/mongo');
const { attachSocket } = require('./src/realtime/socket');
const { startParseJob } = require('./src/jobs/parse.job');
const { startDigestJob } = require('./src/jobs/digest.job');
const RawMessage = require('./src/db/models/RawMessage');

const app = express();
app.use(helmet());
app.use(cors({ origin: env.corsOrigins.length ? env.corsOrigins : true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(env.logLevel));

/**
 * Silent ingest death is this system's characteristic failure mode, and on a
 * phone-driven pipeline it is even easier to not notice. So health reports
 * when the last message actually arrived.
 */
app.get('/api/health', async (req, res) => {
  let lastMessageAt = null;
  try {
    const [last] = await RawMessage.find().sort({ receivedAt: -1 }).limit(1).select('receivedAt').lean();
    lastMessageAt = last?.receivedAt || null;
  } catch { /* mongo down — reported below */ }

  res.json({
    ok: isConnected(),
    mongo: isConnected() ? 'connected' : 'disconnected',
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

async function main() {
  await connect();

  const server = http.createServer(app);
  const io = attachSocket(server);
  app.set('io', io);

  startParseJob(io);
  startDigestJob(io);

  server.listen(env.port, () => {
    console.log(`\n  NRYN Finance backend`);
    console.log(`  api     http://localhost:${env.port}/api/health`);
    console.log(`  tz      ${env.tz}`);
    console.log(`  llm     ${env.capabilities.llmFallback ? 'enabled' : 'DISABLED (regex-only — nothing leaves this machine)'}`);
    console.log(`  gmail   ${env.capabilities.gmail ? 'configured' : 'not configured (phase 2)'}\n`);
  });
}

main().catch((err) => {
  console.error('  FATAL  ', err);
  process.exit(1);
});
