'use strict';
process.env.TZ_APP = 'Asia/Kolkata';
const test = require('node:test');
const assert = require('node:assert');
const N = require('../src/parse/normalize');
const { runPatterns } = require('../src/parse/patterns');

const ctx = (sender) => ({ sender, receivedAt: new Date('2026-09-21T13:45:00+05:30'), source: 'sms' });

/* ── §6.1 money is integer paise, never floats ───────────────────── */
test('amount formats all normalize to paise', () => {
  assert.strictEqual(N.toPaise('Rs.1,234.00'), 123400);
  assert.strictEqual(N.toPaise('INR 1234'), 123400);
  assert.strictEqual(N.toPaise('₹1234.5'), 123450);
  assert.strictEqual(N.toPaise('Rs 45,000/-'), 4500000);
  assert.strictEqual(N.toPaise('1.2L'), 12000000);
  assert.strictEqual(N.toPaise('15K'), 1500000);
  assert.strictEqual(N.toPaise('not a number'), null);
});

test('no float drift across a month of small spends', () => {
  const spends = Array.from({ length: 300 }, () => N.toPaise('0.10'));
  assert.strictEqual(spends.reduce((a, b) => a + b, 0), 3000); // exactly Rs 30.00
});

/* ── real bank SMS shapes ────────────────────────────────────────── */
const SAMPLES = [
  {
    name: 'HDFC UPI debit',
    sender: 'AD-HDFCBK',
    body: 'Rs.450.00 debited from a/c XX1234 on 21-09-26 to VPA swiggy@ybl. Ref 432198765123. Not you? Call 18002586161.',
    expect: { amount: 45000, direction: 'debit', method: 'upi', last4: '1234', merchant: 'Swiggy' },
  },
  {
    name: 'ICICI debit with merchant after semicolon',
    sender: 'VM-ICICIB',
    body: 'ICICI Bank Acct XX9012 debited for Rs 1,250.00 on 20-Sep-26; BIGBASKET credited. UPI:556677889900. Call 18002662 for dispute.',
    expect: { amount: 125000, direction: 'debit', last4: '9012' },
  },
  {
    name: 'SBI UPI debit',
    sender: 'JD-SBIUPI',
    body: 'Dear UPI user A/C X7788 debited by 180.0 on date 21Sep26 trf to ZEPTO MARKETPLACE Refno 119283746510. If not u? call 1800111109. -SBI',
    expect: { amount: 18000, direction: 'debit', last4: '7788' },
  },
  {
    name: 'Axis card swipe',
    sender: 'AD-AXISBK',
    body: 'Spent Card no. XX4455 INR 2399 21-09-26 AMAZON RETAIL Avl Lmt INR 87601. Not you? SMS BLOCK 4455 to 918691000002',
    expect: { amount: 239900, direction: 'debit', accountType: 'credit_card' },
  },
  {
    name: 'Kotak UPI sent',
    sender: 'VK-KOTAKB',
    body: 'Sent Rs.320.00 from Kotak Bank AC X3344 to uber@icici on 21-09-26. UPI Ref 998877665544. Not you, kotak.com/fraud',
    expect: { amount: 32000, direction: 'debit', method: 'upi' },
  },
  {
    name: 'salary credit',
    sender: 'AD-HDFCBK',
    body: 'Rs.85,000.00 credited to a/c XX1234 on 01-09-26 by NEFT from KINDERSPORTS LLP. Avl bal Rs 1,02,340.55',
    expect: { amount: 8500000, direction: 'credit', noRefId: true },
  },
];

for (const s of SAMPLES) {
  test(`parses: ${s.name}`, () => {
    const hit = runPatterns(s.body, ctx(s.sender));
    assert.ok(hit, 'no parser matched');
    assert.strictEqual(hit.amount, s.expect.amount, 'amount');
    assert.strictEqual(hit.direction, s.expect.direction, 'direction');
    if (s.expect.last4) assert.strictEqual(hit.last4, s.expect.last4, 'last4');
    if (s.expect.method) assert.strictEqual(hit.method, s.expect.method, 'method');
    if (s.expect.accountType) assert.strictEqual(hit.accountType, s.expect.accountType, 'accountType');
    if (!s.expect.noRefId && !s.name.includes('card')) assert.ok(hit.refId, 'refId expected');
    if (s.expect.merchant) assert.strictEqual(N.cleanMerchant(hit.merchantRaw), s.expect.merchant, 'merchant');
  });
}

test('SMS date beats receivedAt (§11.5)', () => {
  const hit = runPatterns(SAMPLES[1].body, ctx('VM-ICICIB'));
  assert.strictEqual(hit.occurredAt.toISOString().slice(0, 10), '2026-09-20');
});

/* ── §6.2 debit !== expense ──────────────────────────────────────── */
test('credit card bill payment is not an expense', () => {
  const v = N.classify({ body: 'Rs.24,500.00 debited from a/c XX1234 towards Credit Card Bill payment for card ending 4455.', direction: 'debit' });
  assert.strictEqual(v.isExpense, false);
  assert.strictEqual(v.category, 'transfer');
});

test('SIP debit is investment, not spend', () => {
  const v = N.classify({ body: 'Rs.10,000.00 debited for SIP in Parag Parikh Flexi Cap Fund folio 12345.', direction: 'debit' });
  assert.strictEqual(v.isExpense, false);
  assert.strictEqual(v.category, 'investment');
});

test('declined transaction is dropped entirely', () => {
  const v = N.classify({ body: 'Your txn of Rs.5000 on card XX4455 was DECLINED due to insufficient balance.', direction: 'debit' });
  assert.strictEqual(v.drop, true);
});

test('self transfer to own UPI handle is not an expense', () => {
  const user = { upiHandles: ['hrishikesh@okhdfcbank'], accounts: [] };
  const v = N.classify({ body: 'Rs.5000 debited to VPA hrishikesh@okhdfcbank', direction: 'debit', merchantKey: N.merchantKey('hrishikesh@okhdfcbank'), user });
  assert.strictEqual(v.isExpense, false);
  assert.strictEqual(v.category, 'transfer');
});

test('a plain UPI spend IS an expense', () => {
  const v = N.classify({ body: 'Rs.450.00 debited to VPA swiggy@ybl', direction: 'debit', merchantKey: 'swiggy' });
  assert.strictEqual(v.isExpense, true);
});

/* ── §9 redaction ────────────────────────────────────────────────── */
test('long digit runs are redacted to last4 before storage', () => {
  const out = N.redact('Card 4532 1122 3344 5566 used at DMART');
  assert.ok(!out.includes('4532 1122 3344 5566'));
  assert.ok(out.includes('5566'));
});

/* ── merchant key stability ──────────────────────────────────────── */
test('merchant key collapses bank noise to one stable key', () => {
  assert.strictEqual(N.merchantKey('SWIGGY*ORDER'), 'swiggyorder');
  assert.strictEqual(N.merchantKey('swiggy@ybl'), 'swiggy');
  assert.strictEqual(N.merchantKey('Swiggy'), 'swiggy');
});
