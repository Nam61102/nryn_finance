'use strict';
process.env.TZ = 'UTC';                 // Deliberately hostile: server running in UTC
process.env.TZ_APP = 'Asia/Kolkata';

const test = require('node:test');
const assert = require('node:assert');

const Transaction = require('../src/db/models/Transaction');
const Account = require('../src/db/models/Account');
const Policy = require('../src/db/models/Policy');
const User = require('../src/db/models/User');
const budgetService = require('../src/finance/budget.service');

const { detectSubscriptions } = require('../src/copilot/subscription.service');
const { calculateTaxRadar } = require('../src/copilot/tax.service');
const { calculateSafeSpend } = require('../src/copilot/safespend.service');
const { processChat } = require('../src/copilot/copilot.service');
const { generateRecommendations } = require('../src/copilot/recommendations.service');
const { detectAnomalies } = require('../src/copilot/anomaly.service');
const { resolveMonth, resolveFinancialYear } = require('../src/finance/period');

// Helper to mock chainable Mongoose queries (.sort, .limit, .select, .lean) and direct await
function mockChain(result) {
  const promise = Promise.resolve(result);
  const chain = {
    sort: () => chain,
    limit: () => chain,
    select: () => chain,
    lean: () => Promise.resolve(result),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
  return chain;
}

/* ── Test 1: Subscription service returns empty for new user ──────── */
test('Test 1: Subscription service returns empty (count=0, empty=true, totals=0) for a new user with no recurring txns', async () => {
  const origFind = Transaction.find;
  Transaction.find = () => mockChain([]);
  try {
    const res = await detectSubscriptions('test-user-1');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.count, 0);
    assert.strictEqual(res.empty, true);
    assert.strictEqual(res.totalMonthlyRecurringPaise, 0);
    assert.strictEqual(res.totalMonthlyRecurringINR, 0);
    assert.strictEqual(res.totalAnnualCostINR, 0);
    assert.deepStrictEqual(res.subscriptions, []);
    assert.deepStrictEqual(res.zombieSubscriptions, []);
  } finally {
    Transaction.find = origFind;
  }
});

/* ── Test 2: Recurring subscription detection requirements ────────── */
test('Test 2: Subscription detected only after 2+ monthly charges (within 90 days, similar amount); no fake zombie flag', async () => {
  const origFind = Transaction.find;
  try {
    // 2A: Single charge in 90 days -> NOT a subscription
    Transaction.find = () => mockChain([
      {
        merchantName: 'Netflix',
        merchantRaw: 'NETFLIX INDIA',
        amount: 49900,
        occurredAt: new Date('2026-02-15T10:00:00.000Z'),
        category: 'entertainment',
      },
    ]);
    const resSingle = await detectSubscriptions('test-user-2');
    assert.strictEqual(resSingle.count, 0);
    assert.strictEqual(resSingle.empty, true);

    // 2B: Two charges across 2 different calendar months with similar amount (±15%)
    Transaction.find = () => mockChain([
      {
        merchantName: 'Netflix',
        merchantRaw: 'NETFLIX INDIA',
        amount: 49900,
        occurredAt: new Date('2026-02-15T10:00:00.000Z'),
        category: 'entertainment',
      },
      {
        merchantName: 'Netflix',
        merchantRaw: 'NETFLIX INDIA',
        amount: 49900,
        occurredAt: new Date('2026-01-15T10:00:00.000Z'),
        category: 'entertainment',
      },
    ]);
    const resTwo = await detectSubscriptions('test-user-2');
    assert.strictEqual(resTwo.count, 1);
    assert.strictEqual(resTwo.empty, false);
    assert.strictEqual(resTwo.subscriptions[0].name, 'Netflix');
    assert.strictEqual(resTwo.subscriptions[0].amountPaise, 49900);
    assert.strictEqual(resTwo.subscriptions[0].occurrences, 2);
    // Crucial: no fake zombie flag
    assert.strictEqual(resTwo.subscriptions[0].isZombie, false);
    assert.strictEqual(resTwo.subscriptions[0].zombieReason, null);
  } finally {
    Transaction.find = origFind;
  }
});

/* ── Test 3: Tax service FY boundaries in IST ─────────────────────── */
test('Test 3: Tax service: FY boundaries in Feb (previous year start) and May (current year start)', () => {
  // February date: IST month is Feb 2026 -> FY is 2025-26 (1 Apr 2025 to 31 Mar 2026)
  const febDate = new Date('2026-02-10T10:00:00.000Z');
  const fyFeb = resolveFinancialYear(febDate);
  assert.strictEqual(fyFeb.startYear, 2025);
  assert.strictEqual(fyFeb.endYear, 2026);
  assert.strictEqual(fyFeb.financialYear, '2025-26');
  assert.strictEqual(fyFeb.start.toISOString(), '2025-03-31T18:30:00.000Z'); // 1 Apr 2025 00:00 IST
  assert.strictEqual(fyFeb.end.toISOString(), '2026-03-31T18:29:59.999Z');   // 31 Mar 2026 23:59:59.999 IST

  // May date: IST month is May 2026 -> FY is 2026-27 (1 Apr 2026 to 31 Mar 2027)
  const mayDate = new Date('2026-05-10T10:00:00.000Z');
  const fyMay = resolveFinancialYear(mayDate);
  assert.strictEqual(fyMay.startYear, 2026);
  assert.strictEqual(fyMay.endYear, 2027);
  assert.strictEqual(fyMay.financialYear, '2026-27');
  assert.strictEqual(fyMay.start.toISOString(), '2026-03-31T18:30:00.000Z'); // 1 Apr 2026 00:00 IST
  assert.strictEqual(fyMay.end.toISOString(), '2027-03-31T18:29:59.999Z');   // 31 Mar 2027 23:59:59.999 IST
});

/* ── Test 4: Tax service regime awareness ─────────────────────────── */
test('Test 4: Tax service: new regime returns notApplicable:true, no fake EPF/health items; regime null returns regimeUnknown:true', async () => {
  const origUserFindById = User.findById;
  const origPolicyFind = Policy.find;
  const origTxnFind = Transaction.find;

  try {
    Policy.find = () => mockChain([]);
    Transaction.find = () => mockChain([]);

    // 4A: New Regime
    User.findById = () => mockChain({ _id: 'u-new', taxRegime: 'new' });
    const resNew = await calculateTaxRadar('u-new');
    assert.strictEqual(resNew.taxRegime, 'new');
    assert.strictEqual(resNew.section80C.notApplicable, true);
    assert.strictEqual(resNew.section80D.notApplicable, true);
    assert.strictEqual(resNew.section80C.items.length, 0);
    assert.strictEqual(resNew.section80D.items.length, 0);
    assert.strictEqual(resNew.totalDeductionClaimedINR, 0);

    // 4B: Regime Unknown (null)
    User.findById = () => mockChain({ _id: 'u-null', taxRegime: null });
    const resNull = await calculateTaxRadar('u-null');
    assert.strictEqual(resNull.regimeUnknown, true);
    assert.strictEqual(resNull.taxRegime, null);
  } finally {
    User.findById = origUserFindById;
    Policy.find = origPolicyFind;
    Transaction.find = origTxnFind;
  }
});

/* ── Test 5: Safe spend IST month boundary filtering ──────────────── */
test('Test 5: Safe spend: txn at 23:50 IST on last day of month counts in that month, txn at 00:10 IST on 1st counts in next month', async () => {
  // 31 March 2026 23:50 IST is 2026-03-31 18:20 UTC
  const lastDayTxn = new Date('2026-03-31T18:20:00.000Z');
  // 1 April 2026 00:10 IST is 2026-03-31 18:40 UTC
  const nextMonthTxn = new Date('2026-03-31T18:40:00.000Z');

  const marPeriod = resolveMonth('2026-03');
  const aprPeriod = resolveMonth('2026-04');

  assert.ok(lastDayTxn >= marPeriod.start && lastDayTxn <= marPeriod.end, '23:50 IST on 31 Mar must be in March');
  assert.ok(!(lastDayTxn >= aprPeriod.start && lastDayTxn <= aprPeriod.end), '23:50 IST on 31 Mar must not be in April');

  assert.ok(nextMonthTxn >= aprPeriod.start && nextMonthTxn <= aprPeriod.end, '00:10 IST on 1 Apr must be in April');
  assert.ok(!(nextMonthTxn >= marPeriod.start && nextMonthTxn <= marPeriod.end), '00:10 IST on 1 Apr must not be in March');

  const origResolveBudgets = budgetService.resolveBudgets;
  const origAccountFind = Account.find;
  const origTxnFind = Transaction.find;

  try {
    budgetService.resolveBudgets = async () => ({ total: { amount: 5000000 } }); // ₹50k budget
    Account.find = () => mockChain([]);

    Transaction.find = (filter) => {
      assert.strictEqual(filter.deletedAt, null);
      const allTxns = [
        { amount: 50000, occurredAt: lastDayTxn },
        { amount: 80000, occurredAt: nextMonthTxn },
      ];
      const filtered = allTxns.filter(
        (t) => t.occurredAt >= filter.occurredAt.$gte && t.occurredAt <= filter.occurredAt.$lte
      );
      return mockChain(filtered);
    };

    const resMar = await calculateSafeSpend('u1', '2026-03');
    // Spent in March should only include the 50000 paise (₹500), not the 80000 paise
    assert.strictEqual(resMar.totalSpentSoFarPaise, 50000);
  } finally {
    budgetService.resolveBudgets = origResolveBudgets;
    Account.find = origAccountFind;
    Transaction.find = origTxnFind;
  }
});

/* ── Test 6: Soft-deletes excluded across all copilot queries ──────── */
test('Test 6: Soft-deleted txns (deletedAt set) excluded across safe spend, subs, tax, recommendations, anomalies', async () => {
  const origTxnFind = Transaction.find;
  const origPolicyFind = Policy.find;
  const origUserFindById = User.findById;
  const origAccountFind = Account.find;
  const origResolveBudgets = budgetService.resolveBudgets;

  const capturedFilters = [];

  try {
    Transaction.find = (filter) => {
      capturedFilters.push(filter);
      return mockChain([]);
    };
    Policy.find = () => mockChain([]);
    User.findById = () => mockChain({ _id: 'u1', taxRegime: 'old' });
    Account.find = () => mockChain([]);
    budgetService.resolveBudgets = async () => ({ total: { amount: 0 } });

    // 1. Safe spend
    await calculateSafeSpend('u1', '2026-03');
    // 2. Subscriptions
    await detectSubscriptions('u1');
    // 3. Tax radar
    await calculateTaxRadar('u1');
    // 4. Recommendations
    await generateRecommendations('u1', '2026-03');
    // 5. Anomalies
    await detectAnomalies('u1');

    assert.strictEqual(capturedFilters.length >= 5, true);
    for (const filter of capturedFilters) {
      assert.strictEqual(filter.deletedAt, null, `Filter ${JSON.stringify(filter)} must exclude soft-deleted items`);
    }
  } finally {
    Transaction.find = origTxnFind;
    Policy.find = origPolicyFind;
    User.findById = origUserFindById;
    Account.find = origAccountFind;
    budgetService.resolveBudgets = origResolveBudgets;
  }
});

/* ── Test 7: Safe spend without budget returns hasBudget:false ─────── */
test('Test 7: Safe spend with no budget returns hasBudget:false, 0 daily limit', async () => {
  const origResolveBudgets = budgetService.resolveBudgets;
  const origTxnFind = Transaction.find;
  const origAccountFind = Account.find;

  try {
    budgetService.resolveBudgets = async () => ({ total: { amount: 0 } });
    Transaction.find = () => mockChain([]);
    Account.find = () => mockChain([]);

    const res = await calculateSafeSpend('u1', '2026-03');
    assert.strictEqual(res.hasBudget, false);
    assert.strictEqual(res.dailySafeSpendPaise, 0);
    assert.strictEqual(res.dailySafeSpendINR, 0);
    assert.strictEqual(res.totalBudgetPaise, 0);
    assert.strictEqual(res.burnStatus, 'no_budget');
  } finally {
    budgetService.resolveBudgets = origResolveBudgets;
    Transaction.find = origTxnFind;
    Account.find = origAccountFind;
  }
});

/* ── Test 8: Copilot replies contain no hardcoded fallback numbers ─── */
test('Test 8: Copilot rules reply contains no hard-coded fallback numbers when data is empty', async () => {
  const origTxnFind = Transaction.find;
  const origAccountFind = Account.find;
  const origPolicyFind = Policy.find;
  const origUserFindById = User.findById;
  const origResolveBudgets = budgetService.resolveBudgets;

  try {
    Transaction.find = () => mockChain([]);
    Account.find = () => mockChain([]);
    Policy.find = () => mockChain([]);
    User.findById = () => mockChain({ _id: 'u1', taxRegime: null });
    budgetService.resolveBudgets = async () => ({ total: { amount: 0 } });

    const queries = [
      'Can I spend 500 today?',
      'How much can I safely spend?',
      'Show my subscriptions',
      'How is my home loan?',
      'How can I save tax?',
      'How much did I spend on Swiggy?',
    ];

    const forbiddenNumbers = ['354', '650', '2127', '25524', '3588', '48000', '68000', '23800', '35,00,000', '3500000'];
    const forbiddenStrings = ['Disney+ Hotstar', 'Hotstar has had low engagement', 'cook at home to save ₹3,500'];

    for (const q of queries) {
      const res = await processChat('u1', q);
      assert.strictEqual(res.source, 'rules');
      assert.ok(res.reply && res.reply.length > 0, `Reply for "${q}" should not be empty`);

      for (const num of forbiddenNumbers) {
        assert.ok(!res.reply.includes(num), `Reply for "${q}" should not contain fake fallback number "${num}": got "${res.reply}"`);
      }
      for (const str of forbiddenStrings) {
        assert.ok(!res.reply.includes(str), `Reply for "${q}" should not contain fake phrase "${str}": got "${res.reply}"`);
      }
    }
  } finally {
    Transaction.find = origTxnFind;
    Account.find = origAccountFind;
    Policy.find = origPolicyFind;
    User.findById = origUserFindById;
    budgetService.resolveBudgets = origResolveBudgets;
  }
});

/* ── Test 9: buildBlocks generates rich cards from live data ───────── */
test('Test 9: buildBlocks returns rich cards without hallucinated figures', () => {
  const { buildBlocks } = require('../src/copilot/blocks.service');
  
  // Test 9A: Affordability with budget
  const blocks1 = buildBlocks('Can I afford 2000?', {
    safeSpend: { hasBudget: true, dailySafeSpendINR: 2500, todaySpentINR: 500, todayRemainingINR: 2000, burnStatus: 'green' },
    askAmt: 2000,
  });
  assert.ok(Array.isArray(blocks1) && blocks1.length >= 2);
  assert.strictEqual(blocks1[0].type, 'verdict');
  assert.strictEqual(blocks1[0].status, 'approved');
  assert.strictEqual(blocks1[1].type, 'progress');

  // Test 9B: Affordability without budget
  const blocks2 = buildBlocks('Can I afford 1000?', { safeSpend: { hasBudget: false } });
  assert.strictEqual(blocks2[0].type, 'verdict');
  assert.strictEqual(blocks2[0].status, 'info');
  assert.strictEqual(blocks2[1].type, 'actions');

  // Test 9C: Food breakdown
  const blocks3 = buildBlocks('How much did I spend on food?', {
    foodTxns: [
      { _id: 't1', amount: 45000, merchantName: 'Swiggy', category: 'food', occurredAt: new Date() },
    ],
  });
  assert.ok(blocks3.some((b) => b.type === 'stat'));
  assert.ok(blocks3.some((b) => b.type === 'transactions'));
});

/* ── Test 10: streamChat emits valid SSE stream events ─────────────── */
test('Test 10: streamChat emits blocks, delta, and done SSE events', async () => {
  const { streamChat } = require('../src/copilot/copilot.service');
  const origTxnFind = Transaction.find;
  const origAccountFind = Account.find;
  const origPolicyFind = Policy.find;
  const origUserFindById = User.findById;
  const origResolveBudgets = budgetService.resolveBudgets;

  try {
    Transaction.find = () => mockChain([]);
    Account.find = () => mockChain([]);
    Policy.find = () => mockChain([]);
    User.findById = () => mockChain({ _id: 'u1', taxRegime: null });
    budgetService.resolveBudgets = async () => ({ total: { amount: 0 } });

    const events = [];
    const mockRes = {
      setHeader: () => {},
      write: (str) => {
        const lines = str.split('\n');
        const evLine = lines.find((l) => l.startsWith('event: '));
        const dataLine = lines.find((l) => l.startsWith('data: '));
        if (evLine && dataLine) {
          events.push({
            event: evLine.replace('event: ', '').trim(),
            data: JSON.parse(dataLine.replace('data: ', '').trim()),
          });
        }
      },
      end: () => {},
    };

    await streamChat('u1', 'Can I spend ₹500 today?', [], mockRes);

    const eventTypes = events.map((e) => e.event);
    assert.ok(eventTypes.includes('blocks'), 'Stream must emit blocks event');
    assert.ok(eventTypes.includes('delta'), 'Stream must emit delta events');
    assert.ok(eventTypes.includes('done'), 'Stream must emit done event');

    const blocksEv = events.find((e) => e.event === 'blocks');
    assert.ok(Array.isArray(blocksEv.data.blocks), 'blocks event must provide an array of blocks');
  } finally {
    Transaction.find = origTxnFind;
    Account.find = origAccountFind;
    Policy.find = origPolicyFind;
    User.findById = origUserFindById;
    budgetService.resolveBudgets = origResolveBudgets;
  }
});

