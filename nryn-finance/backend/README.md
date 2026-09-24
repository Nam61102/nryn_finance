# NRYN Finance — backend

Express + Mongoose on **:4200**, Mongo `nryn_finance` on 127.0.0.1:27017.

```bash
npm install
npm run db:indexes     # first, always
npm run db:seed        # merchant memory with icons
npm run dev
npm test               # 26 tests
```

## Where the important logic lives

| Concern | File |
|---|---|
| Money is integer paise, amount formats, dates, redaction | `src/parse/normalize.js` |
| **`debit !== expense`** — self-transfers, CC bills, SIPs, refunds | `src/parse/normalize.js` → `classify()` |
| Bank regex parsers (HDFC/ICICI/SBI/Axis/Kotak + generic) | `src/parse/patterns/` |
| regex → LLM → normalize → dedupe → categorize → write | `src/parse/parse.service.js` |
| Dedupe chain, incl. parsed-over-manual merge | `src/finance/transaction.repo.js` |
| Merchant memory — correct once, right forever | `src/ai/categorize.service.js` |
| Every month boundary, in IST | `src/finance/period.js` |
| Ring + chips + pace, one call | `src/finance/budget.service.js` |
| Categories, icons, colours — one source of truth | `src/shared/categories.js` |

## API

```
POST   /api/auth/register · /login          GET /api/auth/me   PATCH /api/auth/accounts
POST   /api/ingest/sms                      → 202 { accepted, duplicates, cursor }
GET    /api/ingest/cursor?deviceId          POST /api/ingest/backfill-done
GET    /api/ingest/stats                    ← last message age, counts by status

GET    /api/transactions?month&category&sort&needsReview&cursor
POST   /api/transactions                    ← manual entry, 409 on near-duplicate
GET/PATCH/DELETE /api/transactions/:id

GET    /api/analytics/summary?month · /by-category?month · /series?range · /months
GET    /api/budgets?month · POST · PATCH /:id · DELETE /:id
GET    /api/budgets/status?month            ← ring + chips + pace, ONE call
GET    /api/categories · /api/alerts · /api/health
```

## After changing a parser

```bash
node scripts/replay.js --since=2026-09-01 --dry-run
```

Re-parses stored raw messages and prints a diff before writing anything. It
skips manual transactions and preserves every field the user edited — losing a
hand-typed correction to a regex change would be the worst bug in this app.

## LLM

Off by default (`LLM_FALLBACK_ENABLED=false`). Regex-only gets ~90% coverage;
the rest land in "Needs review". Turn it on only after you've written parsers
against your own banks' wording — and note that digits are redacted before any
prompt is built.
