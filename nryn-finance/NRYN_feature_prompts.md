# NRYN Finance — Antigravity prompts for the 5 standout features

Run them in this order (each one depends on the previous):

| # | Prompt | Depends on |
|---|---|---|
| 1 | Forecast — BACKEND | — |
| 2 | Forecast — FRONTEND | 1 |
| 3 | Health Score — BACKEND | 1 (salary detection) |
| 4 | Health Score — FRONTEND | 3 |
| 5 | AI Agent — BACKEND | 1, 3 |
| 6 | AI Agent — FRONTEND | 5 |
| 7 | Nudges — BACKEND | 1 |
| 8 | Nudges — FRONTEND | 7 |
| 9 | Money Wrapped — BACKEND | 7 (for the monthly nudge) |
| 10 | Money Wrapped — FRONTEND | 9 |

**How to use:** in a fresh Antigravity chat, paste the **COMMON RULES** block first, then one feature prompt.
Run `git commit` before every prompt so you can roll back.

---

## COMMON RULES (paste at the top of EVERY prompt)

```text
PROJECT: NRYN Finance — Indian personal-finance app.
- backend/ → Node 20, Express, Mongoose, luxon. Port 4200. MongoDB nryn_finance.
- mobile/  → Expo SDK 52, React Native 0.76, expo-router 4, TypeScript, react-native-svg,
             react-native-reanimated. Runs on Android dev build AND web (react-native-web).

NON-NEGOTIABLE RULES
1. Money is integer PAISE everywhere in the backend and API. Only the UI divides by 100.
2. All day/week/month logic is in IST using backend/src/finance/period.js (ZONE, resolveMonth,
   startOfToday). Add helpers there if needed — never use new Date(y,m,d) or Date.UTC for buckets.
3. Every Transaction query filters deletedAt: null. Spend = direction:'debit' AND isExpense:true.
4. NEVER return fake, default or sample numbers. If data is missing, return a clear flag
   (e.g. balanceKnown:false, status:'not_enough_data', empty:true) and let the UI show an empty state.
5. Every route uses requireAuth. userId always comes from req.userId, never from the body or the LLM.
6. Follow the existing code style (CommonJS 'use strict' in backend; existing theme/ui components
   in mobile). Reuse existing services instead of duplicating logic.
7. Backend: add node:test tests for new logic and add them to the "test" script in
   backend/package.json. `cd backend && npm test` must pass.
8. Mobile: use useTheme()/makeStyles and the components in mobile/src/components/ui/
   (Card, Button, Skeleton, EmptyState, AnimatedNumber, etc.). Must look right in light AND dark mode.
   Use lucide icons, never emoji. Format money with the shared formatINR helper (₹1,50,000).
   Install native packages only with `npx expo install`. `cd mobile && npx tsc --noEmit` must pass.
9. Before coding: read the files listed in the prompt, write a short plan, list files to create/change.
   After coding: summarise files changed, new packages, and anything I must do manually.
```

---

## 1 · FORECAST — BACKEND

```text
FEATURE: Cash-flow forecast till salary day.
Predict the user's bank balance for each day until the next salary and tell them if/when it hits ₹0.

READ FIRST: backend/src/finance/period.js, backend/src/db/models/{Transaction,Account,User}.js,
backend/src/copilot/subscription.service.js, backend/src/copilot/safespend.service.js, backend/server.js.

CREATE
backend/src/shared/salary.js
backend/src/forecast/balance.service.js
backend/src/forecast/forecast.service.js
backend/src/forecast/forecast.controller.js
backend/src/routes/forecast.routes.js
backend/tests/salary.test.js
backend/tests/forecast.test.js

CHANGE
backend/src/db/models/User.js  → add manualBalance: { amountPaise: Number, at: Date } (default null)
backend/server.js              → app.use('/api/forecast', require('./src/routes/forecast.routes'))

1) shared/salary.js → detectSalary(userId)
   - Look at credits (direction:'credit', deletedAt:null) in the last 120 days, amount ≥ ₹10,000.
   - Salary = credits that repeat in ≥2 different months on a similar day-of-month (±3 days)
     with similar amount (±20%), OR whose merchantRaw/note contains SALARY / SAL / PAYROLL.
   - Return { found:true, amountPaise, dayOfMonth, expectedDate:'YYYY-MM-DD' (next one, IST),
     lastCreditedAt, confidence:0..1 } or { found:false }.
   - Export it — Health Score and Nudges will reuse it.

2) forecast/balance.service.js → getStartingBalance(userId)
   Priority:
   a) Latest Transaction per account.last4 that has balanceAfter (last 15 days) → sum them.
   b) Else sum Account.balance for type savings/current where balance > 0.
   c) Else User.manualBalance.
   Return { known:boolean, amountPaise, source:'sms'|'account'|'manual', asOf }.
   Also export setManualBalance(userId, amountPaise).

3) forecast/forecast.service.js → buildForecast(userId, { days = 30 })
   - start = getStartingBalance. If !known → return { balanceKnown:false }.
   - salary = detectSalary. Horizon = until salary.expectedDate (inclusive) if found, else `days`.
   - Fixed events inside the horizon:
       • EMIs: Account type:'loan' → emiAmount on emiDueDate each month.
       • Subscriptions: from detectSubscriptions() → amountPaise on nextRenewalAt.
       • Salary: +amountPaise on expectedDate.
   - dailyBurnPaise = MEDIAN of daily discretionary spend over the last 60 IST days, excluding
     transactions that are EMIs, subscriptions, isRecurring, or single spends > ₹10,000.
     Days with zero spend count as 0. If < 14 days of history → use the mean of available days
     and set lowConfidence:true.
   - Walk day by day from today (IST): balance -= dailyBurn; apply that day's events.
   - zeroDate = first day balance < 0 (null if never).
   - lowestBalancePaise, and dailyCutNeededPaise = amount per day needed so the balance never goes
     below 0 before salary (0 if already safe).
   Return:
   { balanceKnown:true, startBalancePaise, balanceSource, asOf,
     salary:{found, expectedDate, amountPaise, confidence},
     dailyBurnPaise, lowConfidence,
     days:[{ date, balancePaise, events:[{type:'emi'|'subscription'|'salary', label, amountPaise}] }],
     upcoming:[...all events sorted by date],
     zeroDate, lowestBalancePaise, dailyCutNeededPaise }

4) API (forecast.routes.js, all requireAuth)
   GET  /api/forecast?days=30   → buildForecast (days 7–60)
   POST /api/forecast/balance   → body { amountPaise:int ≥0 } → saves manual balance → returns new forecast
   Validate input; 400 on bad values.

5) TESTS
   - salary: detects a monthly salary on the 1st ±3 days; ignores a one-off large credit;
     found:false with no data.
   - forecast: balanceKnown:false with no balance; EMI on the 15th reduces balance that day;
     zeroDate correct; salary resets balance; deleted transactions ignored; IST day boundaries.
```

---

## 2 · FORECAST — FRONTEND

```text
FEATURE: Cash-flow forecast screen + Home card. Backend is ready:
GET /api/forecast?days=30 and POST /api/forecast/balance { amountPaise }.
Response: { balanceKnown, startBalancePaise, balanceSource, asOf, salary{found,expectedDate,amountPaise},
dailyBurnPaise, lowConfidence, days[{date,balancePaise,events[]}], upcoming[], zeroDate,
lowestBalancePaise, dailyCutNeededPaise }

READ FIRST: mobile/src/services/api.ts, mobile/src/theme/*, mobile/src/components/ui/*,
mobile/src/components/home/*, mobile/src/app/(tabs)/index.tsx.

CREATE
mobile/src/services/forecast.api.ts           (getForecast, setManualBalance — typed)
mobile/src/app/forecast.tsx
mobile/src/components/forecast/ForecastChart.tsx
mobile/src/components/forecast/ZeroDateBanner.tsx
mobile/src/components/forecast/UpcomingList.tsx
mobile/src/components/forecast/HomeForecastCard.tsx
mobile/src/components/forecast/ManualBalanceSheet.tsx

CHANGE
mobile/src/app/(tabs)/index.tsx → add HomeForecastCard below the hero card.

UI
1) forecast.tsx (title "Till salary day", subtitle "Projected balance · <today> → <salary date>")
   - ZeroDateBanner: if zeroDate → red-tinted card "You'll hit ₹0 on 27 Oct" +
     "<N> days before salary. Cut ₹<dailyCutNeeded>/day to make it."
     If no zeroDate → green card "You're safe till salary · lowest ₹X on <date>".
   - Card with "Balance today ₹X" (AnimatedNumber) + small source label ("from SMS" / "manual").
   - ForecastChart (react-native-svg): line of balancePaise per day. Orange while ≥0,
     red dashed below 0, dashed ₹0 baseline, dot at zeroDate, green vertical line at the salary date
     labelled "Salary", small yellow dots on EMI days. X labels: 4 evenly spaced dates.
     Animate the line drawing in with Reanimated (skip if reduce-motion is on).
     Tap/drag on the chart shows a tooltip with date + balance.
   - UpcomingList "What's coming": rows date · label · amount (debits normal, salary green +).
     Include a row "Usual spending pace −₹X/day".
   - If lowConfidence → small note "Based on less than 2 weeks of data".
   - If !salary.found → note "Salary not detected yet — showing the next 30 days".
2) Empty state (balanceKnown:false): EmptyState "Add your current balance to see your forecast"
   with a button → ManualBalanceSheet (bottom sheet, numeric input in rupees → convert to paise,
   Save → POST, then reload). Also an "Update balance" link on the screen.
3) HomeForecastCard: compact card. With zeroDate: red dot + "₹0 on 27 Oct" + "Tap to see why".
   Safe: "Safe till salary · 1 Nov". Unknown balance: "Set balance to unlock forecast".
   Tap → router.push('/forecast').
4) Skeleton while loading, pull-to-refresh, friendly error with Retry. Light + dark mode.
```

---

## 3 · HEALTH SCORE — BACKEND

```text
FEATURE: NRYN Score — a financial health score 0–900 with weekly change.

READ FIRST: backend/src/finance/period.js, backend/src/finance/budget.service.js,
backend/src/copilot/anomaly.service.js, backend/src/shared/salary.js,
backend/src/db/models/{Transaction,Budget,Account}.js, backend/src/jobs/digest.job.js, backend/server.js.

CREATE
backend/src/db/models/ScoreSnapshot.js   { userId, weekStart:'YYYY-MM-DD', score, components, createdAt }
                                          unique index (userId, weekStart)
backend/src/score/score.service.js
backend/src/score/score.controller.js
backend/src/routes/score.routes.js
backend/src/jobs/score.job.js
backend/tests/score.test.js

CHANGE
backend/server.js → mount /api/score and start the score job.

1) score.service.js → computeScore(userId)  (window = last 30 IST days)
   - If the user has < 14 days of transaction history → { status:'not_enough_data', daysOfData }.
   - income = salary from salary.js if found, else sum of credits ≥ ₹5,000 that are not
     category 'transfer' / refunds.
   - Components (points):
     • savings (max 300): rate = (income − spend)/income. ≥30% → 300, ≤0% → 0, linear between.
       If income = 0 → 0 points, value "Income not detected".
     • budget (max 250): last full month, % of budgets (total + category) where spent ≤ limit,
       using budget.service. No budgets → 100 points, value "No budgets set".
     • fees (max 150): bank charges/penalties (extract the fee detection from anomaly.service into
       an exported helper and reuse it). ₹0 → 150, −25 per ₹100, min 0.
     • emi (max 200): monthly EMI total (loan Accounts) / income. ≤20% → 200, ≥50% → 0, linear.
       No loans → 200, value "No EMIs".
   - score = sum (0..900). band: <500 Poor, 500–649 Fair, 650–799 Good, ≥800 Excellent.
   - deltaWeek = score − score of the latest ScoreSnapshot older than 6 days (null if none).
   - tip = from the component that lost the most points; include a pointsGain estimate and an
     app route ('/budgets', '/forecast', '/accounts').
   Return:
   { status:'ok', score, band, deltaWeek,
     components:[{key,label,points,max,value}], tip:{text,pointsGain,route}, computedAt }
   - Export saveWeeklySnapshot(userId) (weekStart = Monday in IST).

2) score.job.js → check every minute; on Monday 06:00 IST, once per week, run saveWeeklySnapshot
   for all users. Use the same once-per-period guard style as digest.job.js.

3) API (requireAuth)
   GET /api/score                  → computeScore
   GET /api/score/history?weeks=12 → [{ weekStart, score }] ascending (max 52)

4) TESTS: not_enough_data for a new user; savings 30% → 300; no budgets → 100;
   fees ₹200 → 100; EMI 35% → 100; total & band correct; deltaWeek from snapshot; deleted txns ignored.
```

---

## 4 · HEALTH SCORE — FRONTEND

```text
FEATURE: NRYN Score screen + Home card. Backend ready:
GET /api/score → { status, score, band, deltaWeek, components[{key,label,points,max,value}],
                   tip{text,pointsGain,route}, daysOfData? }
GET /api/score/history?weeks=12 → [{ weekStart, score }]

READ FIRST: mobile/src/services/api.ts, mobile/src/theme/*, mobile/src/components/ui/*,
mobile/src/app/(tabs)/index.tsx, mobile/src/components/copilot/SafeSpendGauge.tsx (gauge style).

CREATE
mobile/src/services/score.api.ts
mobile/src/app/score.tsx
mobile/src/components/score/ScoreGauge.tsx
mobile/src/components/score/ScoreFactorRow.tsx
mobile/src/components/score/ScoreHistoryChart.tsx
mobile/src/components/score/HomeScoreCard.tsx

CHANGE
mobile/src/app/(tabs)/index.tsx → add HomeScoreCard (next to or below HomeForecastCard).

UI
1) ScoreGauge: half-circle SVG arc, track in the cardAlt colour, progress in accent orange,
   big score number in the middle (AnimatedNumber), "out of 900 · <band>" under it.
   Arc animates 0 → score with Reanimated. Props: score, band, size.
2) score.tsx (title "NRYN Score", subtitle "Your money health, updated every Monday"):
   - Gauge card + delta pill: "▲ 18 this week" green / "▼ 12 this week" red / hidden if null.
   - "What makes your score": one ScoreFactorRow per component → label, value text on the right
     (coloured: ≥80% of max green, ≥50% orange, else red), and a progress bar points/max.
     Tap a row → expands a short explanation of how it is calculated.
   - Tip card (accent tinted): tip.text + "+<pointsGain> points" + button → router.push(tip.route).
   - ScoreHistoryChart: simple SVG line of the last 12 weeks (hide if < 2 points).
3) Empty state (status:'not_enough_data'): EmptyState "Your score unlocks after 14 days of data"
   + progress "<daysOfData>/14 days".
4) HomeScoreCard: small gauge (size ~80) + score + band + delta. Tap → /score.
5) Skeletons, pull-to-refresh, error Retry, light + dark mode.
```

---

## 5 · AI AGENT — BACKEND

```text
FEATURE: Replace the keyword-template copilot with a real tool-calling AI agent that streams
answers, remembers the conversation, and returns rich data blocks built from REAL data.

READ FIRST: backend/src/ai/llm.client.js, backend/src/copilot/* (all),
backend/src/finance/{budget.service,analytics.service,period}.js, backend/src/forecast/forecast.service.js,
backend/src/score/score.service.js, backend/src/config/env.js, backend/src/routes/copilot.routes.js.

CREATE
backend/src/db/models/ChatSession.js
  { userId, title, summary, messages:[{ role:'user'|'assistant'|'tool', content, toolName,
    toolArgs, blocks, createdAt }], updatedAt }   index (userId, updatedAt:-1)
backend/src/agent/tools.schema.js   (OpenAI-style JSON schemas for each tool)
backend/src/agent/tools.js          (implementations; each fn(userId, args) → compact JSON)
backend/src/agent/agent.prompt.js
backend/src/agent/agent.service.js
backend/src/agent/agent.controller.js
backend/src/routes/agent.routes.js
backend/tests/agent.tools.test.js

CHANGE
backend/src/ai/llm.client.js → add chatWithTools(messages, tools, { stream, onDelta, signal })
  using the OpenAI-compatible tools API for openrouter / groq / openai, same fallback order.
  Add an 'ollama' provider: OLLAMA_BASE_URL (e.g. http://192.168.1.10:11434/v1), OLLAMA_MODEL.
  New env vars in env.js + .env.example: AGENT_LLM_ENABLED, AGENT_PROVIDER (auto|ollama|cloud),
  OLLAMA_BASE_URL, OLLAMA_MODEL.
backend/server.js → mount /api/agent. Keep /api/copilot/* working for older app builds.

1) TOOLS (all read-only, validate args, max 50 rows returned, amounts in paise)
   - queryTransactions { merchant?, category?, from?, to?, hourFrom?, hourTo?, minAmountPaise?,
       direction?='debit', groupBy?: 'none'|'day'|'week'|'merchant'|'category', limit?=20 }
       → { count, totalPaise, groups?:[{key,count,totalPaise}], items?:[{id,date,merchant,amountPaise,category}] }
       Hours are IST and may wrap midnight (22 → 4). Merchant match is case-insensitive on
       merchantName/merchantRaw.
   - getSpendSummary { month? }   → totals by category + vs last month
   - getBudgetStatus { month? }   → from budget.service.status
   - getSafeSpend {}              → from safespend.service
   - getSubscriptions {}          → from subscription.service
   - getForecast { days? }        → from forecast.service (trim days[] to weekly points)
   - getHealthScore {}            → from score.service
   - simulatePurchase { amountPaise, date? } → effect on today's safe spend and on the forecast zeroDate,
       plus verdict 'yes' | 'caution' | 'no'
   - simulateLoanPrepayment { accountId, extraMonthlyPaise?, lumpSumPaise? } → loan.service with the
       user's REAL loan account; error if not found or not the user's.
   Never include raw SMS text, account numbers or refIds in tool output.

2) agent.service.js → runAgent({ userId, sessionId, message, res, signal })
   - Load/create ChatSession. Build messages: system prompt (agent.prompt.js: NRYN Copilot, Indian
     finance, ₹ with Indian commas, short and specific, ALWAYS use tools for numbers, never guess,
     say clearly when data is missing), session.summary, last 12 messages, the new user message.
   - Loop max 5 iterations: call chatWithTools; if tool_calls → run each tool (userId injected),
     send SSE `tool` event { name, label } (human label like "Searched 142 transactions · 9 matches"),
     append the tool result, continue. Otherwise stream the final text via SSE `delta` events.
   - Build BLOCKS on the server from the tool results used in this turn (NOT from LLM text):
       stat {label,valuePaise,deltaPct?,tone}, progress {label,spentPaise,limitPaise},
       bar {title,items[{label,valuePaise}]}, donut {title,items[{label,valuePaise,color}]},
       transactions {items[]}, subscriptions {items[]},
       verdict {verdict:'yes'|'caution'|'no',title,subtitle} (from simulatePurchase),
       actions {items[{label,route}]}.  Send SSE `blocks`.
   - Get 2–3 suggestedFollowUps (from the LLM or derived from the tools used). Send SSE `done`
     { suggestedFollowUps, source:'llm'|'ollama'|'rules' }.
   - Save user + assistant messages (with blocks) to the session. When messages > 30, summarise the
     oldest 20 into session.summary (one LLM call) and drop them.
   - Session title = first user message trimmed to 40 chars.
   - FALLBACK: if no LLM is available or it fails before any delta → use the existing rule engine
     (copilot.service, real data only) and stream its reply in word chunks; source:'rules'.
   - Respect client abort (signal) — stop the LLM call.

3) API (requireAuth + rate limit 20 req/min per user on chat)
   POST   /api/agent/chat          body { sessionId?, message (1–1000 chars) } → text/event-stream
          events: session, tool, delta, blocks, done, error. Headers: Content-Type text/event-stream,
          Cache-Control no-cache, Connection keep-alive, X-Accel-Buffering no; flush each event.
   GET    /api/agent/sessions      → [{ id, title, updatedAt }] (latest 30)
   GET    /api/agent/sessions/:id  → { id, title, messages } (only user/assistant roles)
   DELETE /api/agent/sessions/:id

4) TESTS (agent.tools.test.js): queryTransactions IST hour filter wrapping midnight (22:00–04:00),
   merchant filter, groupBy week, deleted excluded, user isolation (A can't see B),
   simulatePurchase verdict thresholds, loan tool rejects another user's account.
```

---

## 6 · AI AGENT — FRONTEND

```text
FEATURE: Full-screen streaming AI agent chat with tool chips and rich blocks.
Backend ready:
POST /api/agent/chat { sessionId?, message } → SSE events:
  session {sessionId} · tool {name,label} · delta {text} · blocks {blocks[]} ·
  done {suggestedFollowUps[], source} · error {message}
GET /api/agent/sessions · GET /api/agent/sessions/:id · DELETE /api/agent/sessions/:id
Block types: stat, progress, bar, donut, transactions, subscriptions, verdict, actions
(shapes are in backend/src/agent/agent.service.js — read them).

READ FIRST: mobile/src/components/copilot/* (existing drawer/chat components),
mobile/src/services/api.ts, mobile/src/services/storage.ts, mobile/src/theme/*, mobile/src/components/ui/*.

CREATE
mobile/src/services/agent.api.ts
mobile/src/hooks/useSSE.ts
mobile/src/app/copilot.tsx
mobile/src/components/agent/ChatBubble.tsx
mobile/src/components/agent/ToolChip.tsx
mobile/src/components/agent/TypingIndicator.tsx
mobile/src/components/agent/SuggestionChips.tsx
mobile/src/components/agent/ChatInput.tsx
mobile/src/components/agent/SessionList.tsx
mobile/src/components/agent/BlockRenderer.tsx
mobile/src/components/agent/blocks/{StatBlock,ProgressBlock,BarBlock,DonutBlock,
  TransactionsBlock,SubscriptionsBlock,VerdictBlock,ActionsBlock}.tsx

CHANGE
The floating copilot orb now opens router.push('/copilot') instead of the old drawer.
Remove the old drawer code if nothing else uses it.

1) useSSE.ts: POST with the auth header. Native: `import { fetch } from 'expo/fetch'` (streaming
   body supported in SDK 52); web: global fetch. Read response.body.getReader(), decode with
   TextDecoder, split on blank lines, parse `event:` / `data:` lines, call a handler per event.
   Support AbortController (Stop button). If the stream fails before any delta, retry once.
2) copilot.tsx:
   - Header: Sparkles icon in an orange rounded square, "NRYN Copilot", subtitle from source
     ("Agent · reads your real data" / "Private mode" for ollama / "Offline mode" for rules),
     history button (opens SessionList sheet), close button.
   - Messages list (FlatList, auto-scroll to bottom). User bubble right in accent with dark text;
     assistant bubble left on the card colour.
   - While streaming: TypingIndicator until the first delta, then the text grows; ToolChips appear
     above the assistant bubble as `tool` events arrive (pill: "queryTransactions · 9 matches").
   - After `blocks`: render BlockRenderer inside the assistant bubble (below the text).
   - After `done`: SuggestionChips (horizontal outlined orange pills) → tap sends that text.
   - Render markdown in assistant text (bold, italic, bullet lists, line breaks), themed.
   - Empty chat: greeting + 4 starter chips ("How much did I spend on food this month?",
     "Can I afford ₹2,000 today?", "When will I run out of money?", "What's my NRYN Score?").
   - ChatInput: text field + send button (turns into a Stop square while streaming). Keyboard-safe.
   - Long-press a message → Copy.
   - Save the current sessionId in storage so reopening continues the chat. "New chat" in SessionList.
3) Blocks (react-native-svg, themed, animate in with Reanimated FadeInDown):
   StatBlock 2-up grid tiles; ProgressBlock bar spent/limit; BarBlock vertical bars (highest in
   orange, others muted); DonutBlock with legend; TransactionsBlock compact rows (tap → /transaction/[id]);
   SubscriptionsBlock rows with renewal date; VerdictBlock big coloured card (yes green / caution
   amber / no red) with an icon; ActionsBlock buttons → router.push(route).
4) Errors: `error` event or network failure → assistant bubble "Couldn't reach your data." with a
   Retry button. Haptic light on send, success on done. Works in light + dark and on web.
```

---

## 7 · NUDGES — BACKEND

```text
FEATURE: Proactive nudges — the copilot sends push notifications before problems happen.

READ FIRST: backend/src/db/models/{Device,User,Alert,Transaction}.js, backend/src/jobs/*,
backend/src/parse/parse.service.js, backend/src/realtime/socket.js, backend/src/shared/salary.js,
backend/src/forecast/forecast.service.js, backend/src/copilot/{subscription,anomaly}.service.js,
backend/src/finance/budget.service.js, backend/server.js.

INSTALL: npm i expo-server-sdk

CREATE
backend/src/db/models/Nudge.js
  { userId, type, dedupeKey, title, body, severity:'info'|'warn'|'critical',
    action:{ label, route, kind:'navigate'|null, payload }, data,
    pushed:Boolean, sentAt, readAt, dismissedAt }
  unique index (userId, dedupeKey); index (userId, createdAt:-1)
backend/src/nudges/push.service.js     (Expo push; chunk messages; clear tokens on DeviceNotRegistered)
backend/src/nudges/nudge.engine.js
backend/src/nudges/rules/merchantStreak.js
backend/src/nudges/rules/salaryCredited.js
backend/src/nudges/rules/bankFee.js
backend/src/nudges/rules/subscriptionRenewal.js
backend/src/nudges/rules/lowBalance.js
backend/src/nudges/rules/budgetPace.js
backend/src/nudges/nudge.controller.js
backend/src/routes/nudge.routes.js
backend/src/jobs/nudge.job.js
backend/tests/nudges.test.js

CHANGE
Device.js → add pushToken: String, pushTokenUpdatedAt: Date
User.js   → add nudgePrefs: { enabledTypes:[String] (default all), quietStart:'22:00',
             quietEnd:'08:00', maxPerDay: Number default 3 }
parse.service.js → after a NEW transaction is saved, call nudgeEngine.runEvent(userId, txn)
             (fire-and-forget; an error must never break parsing)
server.js → mount routes, start the nudge job.

1) RULES: each file exports { type, trigger:'event'|'schedule', hourIST?, evaluate(userId, ctx) → nudge[] }
   - merchantStreak (event): ≥5 expense txns at the same merchant in the current IST week (Mon–Sun)
     → "5th Swiggy order this week" / "₹1,840 on Swiggy since Monday. That's 2× your usual week."
     (usual = avg weekly spend at that merchant over the previous 8 weeks; drop the comparison if no history)
     Fire at 5, then again at 8. dedupeKey merchantStreak:<merchant>:<weekStart>:<count>. Action → /budgets.
   - salaryCredited (event): new credit matching detectSalary → "Salary credited · ₹62,000" /
     "Move ₹5,000 to savings before the month gets busy?" Dedupe per month. Action → /forecast.
   - bankFee (event): txn looks like a charge/penalty (reuse the anomaly fee helper) →
     severity warn, "₹354 fee charged by HDFC".
   - subscriptionRenewal (schedule, 10:00 IST): renewals tomorrow → "Netflix renews tomorrow · ₹649".
   - lowBalance (schedule, 09:00 IST): buildForecast zeroDate inside the horizon →
     severity critical "At this pace you'll hit ₹0 on 27 Oct" / "Cut ₹120/day to make it to salary."
     Dedupe per zeroDate per week. Action → /forecast.
   - budgetPace (schedule, 19:00 IST): a category or total budget ≥80% used while < 70% of the month
     has passed → "You've used 82% of your Food budget by the 12th". Dedupe per budget/month/threshold (80, 100).
   All text uses real numbers only, Indian ₹ formatting, no emoji.

2) nudge.engine.js
   - runEvent(userId, txn) → event rules; runSchedule(userId, hourIST) → schedule rules due this hour.
   - Export registerRule(rule) so other features can add rules.
   - For each candidate: skip if its type is disabled in prefs; insert with dedupeKey (duplicate key
     error = already sent → skip). If inside quiet hours (IST) → save with pushed:false (delivered on the
     next non-quiet run). If today's pushed count ≥ maxPerDay → save, don't push
     (critical severity bypasses the daily limit but not quiet hours).
   - Push via push.service to every Device.pushToken of the user; set pushed, sentAt.
   - Emit socket io.to(`user:${id}`).emit('nudge:new', nudge).

3) nudge.job.js: check every minute; at minute 0 of each IST hour run runSchedule for all users and
   deliver pending nudges (pushed:false, created < 24h ago, not quiet now). Once-per-hour guard.

4) API (requireAuth)
   POST  /api/devices/push-token  { deviceId, token } (token must start with ExponentPushToken)
   GET   /api/nudges?cursor&unread=true → { items, unreadCount, nextCursor } (20 per page, newest first)
   PATCH /api/nudges/:id          { read?:true, dismissed?:true }
   POST  /api/nudges/read-all
   GET   /api/nudges/settings · PATCH /api/nudges/settings { enabledTypes?, quietStart?, quietEnd?, maxPerDay? (1–10) }
   POST  /api/nudges/test         (only when NODE_ENV !== 'production') → sends a test push

5) TESTS: each rule fires / doesn't fire on crafted data; dedupe prevents repeats; quiet hours in IST
   (22:30 IST = quiet); maxPerDay; critical bypasses the limit; disabled type skipped; deleted txns ignored.
```

---

## 8 · NUDGES — FRONTEND

```text
FEATURE: Push notifications + Nudges inbox. Backend ready:
POST /api/devices/push-token { deviceId, token }
GET /api/nudges?cursor&unread → { items[{_id,type,title,body,severity,action{label,route},createdAt,readAt}],
                                  unreadCount, nextCursor }
PATCH /api/nudges/:id { read|dismissed } · POST /api/nudges/read-all
GET/PATCH /api/nudges/settings { enabledTypes, quietStart, quietEnd, maxPerDay }
Socket event 'nudge:new' on the existing user room.

READ FIRST: mobile/app.json, mobile/eas.json, mobile/src/app/_layout.tsx, mobile/src/services/*,
mobile/src/sync/* (where deviceId comes from), mobile/src/app/(tabs)/index.tsx, (tabs)/profile.tsx, theme + ui.

INSTALL: npx expo install expo-notifications expo-device

CREATE
mobile/src/services/nudges.api.ts
mobile/src/notifications/register.ts
mobile/src/notifications/handlers.ts
mobile/src/hooks/useUnreadNudges.ts
mobile/src/app/nudges.tsx
mobile/src/components/nudges/NudgeCard.tsx
mobile/src/components/nudges/NudgeBell.tsx
mobile/src/components/nudges/NudgeSettings.tsx

CHANGE
app.json → add the expo-notifications plugin (icon + color #FF6D00), android.googleServicesFile "./google-services.json"
_layout.tsx → after login: register push, set the notification handler, listen for taps.
(tabs)/index.tsx header → add NudgeBell. (tabs)/profile.tsx → add a NudgeSettings section.

1) register.ts: only on a physical Android device (expo-device). Create the Android channel "nudges"
   (importance HIGH, light colour #FF6D00). Ask permission AFTER login using a friendly pre-prompt card
   ("Get warned before you overspend"), not on app start. getExpoPushTokenAsync({ projectId from
   Constants.expoConfig.extra.eas.projectId }) → POST push-token with the same deviceId the SMS sync uses.
   Re-send if the token changes. No-op on web.
2) handlers.ts: foreground notifications show as an in-app toast (not a system banner). Tapping a
   notification (foreground / background / cold start) → mark read → router.push(data.route || '/nudges').
3) nudges.tsx: title "Nudges", subtitle "Your copilot speaks up before it's too late".
   Sections TODAY / EARLIER. NudgeCard: tinted lucide icon by type (merchantStreak utensils amber,
   salaryCredited wallet green, bankFee alert red, subscriptionRenewal refresh orange, lowBalance
   trending-down red, budgetPace target orange, wrappedReady sparkles orange), title, time, body,
   primary action button (action.label → route) + Dismiss. Unread cards show a small orange dot.
   Swipe to dismiss. "Mark all read" in the header. Infinite scroll with cursor. Pull to refresh.
   Live insert on socket 'nudge:new' with a slide-in animation + haptic.
   Empty state: "All quiet. We'll nudge you when something needs attention."
4) NudgeBell: bell icon with an orange badge count (useUnreadNudges refreshes on screen focus + socket).
5) NudgeSettings: a toggle per nudge type (friendly names), quiet hours (two time pickers),
   max-per-day stepper (1–10), "Send test notification" in dev builds.
6) At the end, list my manual steps: create a Firebase project, download google-services.json into
   mobile/, upload the FCM V1 key with `eas credentials`, set extra.eas.projectId, rebuild the APK.
```

---

## 9 · MONEY WRAPPED — BACKEND

```text
FEATURE: Monthly "Money Wrapped" story data (like Spotify Wrapped).

READ FIRST: backend/src/finance/{analytics.service,period}.js, backend/src/db/models/Transaction.js,
backend/src/shared/{categories,salary}.js, backend/src/nudges/nudge.engine.js, backend/server.js.

CREATE
backend/src/wrapped/wrapped.service.js
backend/src/wrapped/wrapped.controller.js
backend/src/routes/wrapped.routes.js
backend/src/nudges/rules/wrappedReady.js
backend/tests/wrapped.test.js

CHANGE
backend/server.js → mount /api/wrapped. nudge.engine → register the wrappedReady rule.

1) wrapped.service.js
   - availableMonths(userId): IST months with ≥20 expense transactions; the current month is included
     with partial:true. Newest first.
   - buildWrapped(userId, month 'YYYY-MM'): MongoDB aggregations only (no LLM). Filter
     isExpense:true, direction:'debit', deletedAt:null, IST month range from period.js.
     If < 20 transactions → { status:'not_enough_data', count }.
     Return:
     { status:'ok', month, label:'September 2026', partial,
       totalSpentPaise, txnCount, vsPrevPct (null if no previous data),
       topMerchant:{ name, count, totalPaise },
       topCategory:{ key, label, color, totalPaise, sharePct },
       categories:[top 5 {key,label,color,totalPaise}],
       biggestDay:{ date, totalPaise, txnCount },
       favouriteTime:{ weekday:'Friday', hour:21 }   (most frequent IST weekday + hour),
       noSpendDays, longestNoSpendStreak,
       comparisons:[ up to 2 categories with total smaller than topMerchant.totalPaise, {label,totalPaise} ],
       savedPaise (income − spend for the month if income is known, else null),
       funFacts:[ up to 3 short strings built only from the real numbers above ] }
     Use $dateToParts with timezone 'Asia/Kolkata' for weekday/hour/day grouping.
   - In-memory cache per (userId, month) for 1 hour; never cache a partial month.

2) rules/wrappedReady.js (schedule, 10:00 IST on the 1st of each month): if last month has ≥20 txns →
   nudge title "Your September Wrapped is ready", body "See where your money went last month.",
   action { label:'Watch', route:'/wrapped/2026-09' }. Dedupe per month.

3) API (requireAuth)
   GET /api/wrapped/months          → { months:[{ month, label, partial }] }
   GET /api/wrapped?month=YYYY-MM   → buildWrapped (400 on a bad month format)

4) TESTS: top merchant/category correct; favourite hour in IST (a txn at 23:30 IST counts as hour 23,
   not UTC); no-spend days; not_enough_data; deleted & non-expense excluded; vsPrevPct.
```

---

## 10 · MONEY WRAPPED — FRONTEND

```text
FEATURE: Money Wrapped story viewer with share-as-image. Backend ready:
GET /api/wrapped/months → { months[{month,label,partial}] }
GET /api/wrapped?month=YYYY-MM → { status, label, partial, totalSpentPaise, txnCount, vsPrevPct,
  topMerchant, topCategory, categories[], biggestDay, favouriteTime, noSpendDays,
  longestNoSpendStreak, comparisons[], savedPaise, funFacts[], count? }

READ FIRST: mobile/src/services/api.ts, theme + ui components, mobile/src/app/(tabs)/index.tsx,
mobile/src/app/(tabs)/profile.tsx, mobile/src/notifications/handlers.ts.

INSTALL: npx expo install react-native-view-shot expo-sharing expo-media-library

CREATE
mobile/src/services/wrapped.api.ts
mobile/src/app/wrapped/index.tsx                (list of available months)
mobile/src/app/wrapped/[month].tsx              (story viewer)
mobile/src/components/wrapped/StoryProgress.tsx
mobile/src/components/wrapped/SlideTotal.tsx
mobile/src/components/wrapped/SlideTopMerchant.tsx
mobile/src/components/wrapped/SlideTopCategory.tsx
mobile/src/components/wrapped/SlideFavouriteTime.tsx
mobile/src/components/wrapped/SlideSummary.tsx
mobile/src/components/wrapped/ShareButton.tsx
mobile/src/components/wrapped/WrappedBanner.tsx

CHANGE
(tabs)/index.tsx → show WrappedBanner during the first 7 days of a month if last month is available.
(tabs)/profile.tsx → "Money Wrapped" row → /wrapped.

1) [month].tsx — full-screen story (hide the tab bar, own StatusBar):
   - 5 slides: Total → Top merchant → Top category → Favourite time → Summary.
   - StoryProgress bars at the top (filled = seen, current fills over 6s, then auto-advance).
     Tap right half = next, left half = back, long-press = pause. Close button (X, 44px target).
   - Each slide has its own bold SOLID background (no gradients): orange #FF6D00 with navy text,
     navy #0B1220 with orange accents, etc. Big typography (60–72px headline), decorative
     circles / rounded shapes, Reanimated entrance (numbers count up, text slides up).
   - SlideTotal: "You spent" ₹X · "<txnCount> transactions" · vsPrevPct pill ("8% less than August").
   - SlideTopMerchant: "Your top merchant was" · huge name · "23 orders · ₹6,480" ·
     navy card "That's more than you spent on" + comparisons.
   - SlideTopCategory: donut of the top 5 categories (category colours), top one highlighted with share %.
   - SlideFavouriteTime: "Your favourite time to spend" · "Friday, 9 pm" · biggestDay + no-spend streak.
   - SlideSummary: compact recap + funFacts + savedPaise (only if not null).
   - Every slide: ShareButton → captureRef (react-native-view-shot) of the slide content only
     (no progress bars / close button — wrap slide content in its own View) at 1080×1920 → expo-sharing.
     Also "Save to gallery" (expo-media-library, ask permission). Web: download a PNG.
   - Partial month → small tag "So far this month".
2) Empty (status:'not_enough_data'): EmptyState "Wrapped unlocks after 20 transactions in a month"
   with "<count>/20".
3) wrapped/index.tsx: grid of month cards (label, total) → open the story.
4) WrappedBanner on Home: orange card "Your September Wrapped is ready" + "Watch" button.
   Dismissible (remember the dismissal per month in storage).
5) The wrappedReady push (route /wrapped/YYYY-MM) must open the story directly.
6) Note at the end: react-native-view-shot, expo-sharing and expo-media-library are native → new APK build needed.
```

---

## FINAL CHECK (run after all 10 prompts)

```text
Review the whole project for the 5 new features (Forecast, Score, Agent, Nudges, Wrapped):
1. Run `cd backend && npm test` and `cd mobile && npx tsc --noEmit`; fix every failure.
2. grep the new backend folders for Transaction.find / aggregate and confirm deletedAt:null + IST ranges.
3. grep new backend/mobile code for hard-coded rupee amounts or sample data and remove them.
4. Confirm every new route has requireAuth, and /api/agent/chat has the rate limit.
5. Open each new screen on web (npm run web) in light and dark mode; fix layout/contrast issues.
6. List the manual steps left (Firebase, EAS credentials, APK rebuild) as a checklist.
```
