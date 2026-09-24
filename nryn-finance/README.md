# NRYN Finance

Your spends, read from your own SMS inbox. Android phone → local backend →
local MongoDB. Nothing leaves your machine unless you switch the LLM on.

```
nryn-finance/
├── backend/     Node + Express + Mongoose · port 4200 · mongodb://127.0.0.1:27017/nryn_finance
└── mobile/      Expo (React Native) dev build · Android · reads SMS
```

---

## Run it — in order

### 1. MongoDB (you already have it locally)

```bash
mongosh --eval 'db.runCommand({ping:1})'     # must answer { ok: 1 }
```

### 2. Backend

```bash
cd backend
npm install
npm run db:indexes      # creates every index — do this FIRST, it proves Mongo
npm run db:seed         # ~200 Indian merchants with icons and categories
npm run dev             # http://localhost:4200/api/health
```

`.env` is already filled in with your local URI:

```
MONGO_URI=mongodb://127.0.0.1:27017/nryn_finance
```

**Change `JWT_SECRET` before this leaves your machine.** It ships with a
placeholder.

Check it's alive:

```bash
curl -s localhost:4200/api/health | python3 -m json.tool
```

You should see `"mongo": "connected"` and `"llmFallback": false` — regex-only
parsing, nothing sent to any third party.

### 3a. Quick look in a browser (optional, no build)

```bash
cd mobile && npm install && npm run web
```

Opens http://localhost:8081 with the real dashboard against your local
backend. No SMS reading — that needs Android — but every screen and the
manual + button work. Set `EXPO_PUBLIC_API_URL=http://localhost:4200` for this.

> `localhost:8082` on its own is just the Metro bundler and will always be a
> blank page. The app is served by `npm run web`, not by opening the bundler port.

### 3b. Mobile (the real thing)

**Edit `mobile/.env.local` first.** `EXPO_PUBLIC_API_URL` must be your
computer's **LAN IP**, not `localhost` — on the phone, `localhost` means the
phone itself, and the app will just hang.

```bash
ipconfig getifaddr en0                     # macOS
hostname -I | awk '{print $1}'             # Linux
ipconfig                                   # Windows → IPv4 Address
```

Then:

```bash
cd mobile
npm install
npx expo install --fix                     # aligns RN/Expo package versions
npx expo prebuild --platform android       # generates android/
npx eas build --profile development --platform android
#   …or, with Android Studio installed and a phone plugged in:
npx expo run:android
```

Install the resulting APK on the phone, then:

```bash
npx expo start --dev-client -c             # -c is required after any .env change
```

> **Expo Go will not work.** Reading SMS needs a native module. A dev build is
> not optional, and it is the one step that can fail in a way that invalidates
> everything else — so do it before writing any new feature code.

### 4. First run on the phone

1. Register an account.
2. Read the permission explainer, tap **Allow SMS access**, grant `READ_SMS`.
3. The backfill scans 6 months of inbox with a progress readout.
4. Set a monthly budget on the **Budget** tab — the ring is empty until you do.

### 5. Optional: demo data before a phone is connected

```bash
cd backend
npm run db:demo -- your@email.com
```

Loads ~24 realistic bank SMS (including a credit-card bill payment, a SIP and a
declined txn that must **not** count as spend) plus a month of budgets, and
runs them through the real parser.

---

## Verify it actually works

```bash
cd backend && npm test        # 26 tests: parsers, paise math, isExpense, IST months, pace
cd mobile  && npm run test:filter   # 16 tests: the on-device privacy filter
```

The mobile suite is the important one. It asserts that OTPs, promos and
messages from people are **blocked before the network call** — with the
assertion message "THIS MESSAGE WOULD HAVE LEFT THE PHONE" if one ever slips
through. Run it after any change to `src/native/sms.filter.ts`.

---

## What only bank SMS get analysed means, concretely

```
20,000 SMS in the inbox
      ↓  gate 1  sender is a DLT bank header (AD-HDFCBK, VM-ICICIB…)
      ↓  gate 4  NOT an OTP / promo / loan offer
      ↓  gate 2  contains a rupee amount
      ↓  gate 3  contains transactional words
    ~850  ← only these leave the phone   (src/native/sms.filter.ts)
      ↓  server: regex parsers, ~90% match
     ~85  ← only these would ever reach an LLM, and only if you enable it
```

Personal messages are not filtered later — they never travel. The filter runs
on the device, before `fetch`.

---

## The things most likely to bite you

| Symptom | Cause |
|---|---|
| App hangs on login | `EXPO_PUBLIC_API_URL` is `localhost` or the wrong IP. Use the LAN IP and restart with `-c`. |
| `.env` change did nothing | Expo caches env. `npx expo start -c`. |
| SMS list always empty | Permission denied, or you're on Expo Go / iOS. Android dev build only. |
| Nothing appears after a spend | Check `/api/health` → `minutesSinceLastMessage`. Silent ingest death is this system's characteristic failure. |
| Month totals off by one transaction | Something bucketed in UTC. Everything must go through `finance/period.js`. |
| Duplicate spend after adding cash | Expected once — the 409 guard asks before creating it. See §11.11 in the plan. |

---

## Deliberately not built yet

Gmail ingest (the OAuth flow is ready to port from `nryn-mail`), statement-PDF
parsing, the weekly analytics chart, iOS SMS (impossible), Account Aggregator,
export. Each is additive: `Transaction.source` is an enum, so a new source is a
new ingest route plus one value — never a redesign.

Full reasoning for every decision here lives in the project doc
`claude/finance-agent-plan.md`. Section numbers in the code comments (§6.2,
§7A, §11.11) point at it.
