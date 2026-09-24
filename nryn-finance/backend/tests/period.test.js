'use strict';
process.env.TZ = 'UTC';                 // deliberately hostile: server in UTC
process.env.TZ_APP = 'Asia/Kolkata';
const test = require('node:test');
const assert = require('node:assert');
const { resolveMonth } = require('../src/finance/period');
const { paceFor } = require('../src/finance/budget.service');

/* ── §11.12 month boundaries in IST, even on a UTC server ────────── */
test('March ends at 31 Mar 23:59:59 IST, not 05:29 on 1 Apr', () => {
  const p = resolveMonth('2026-03');
  assert.strictEqual(p.start.toISOString(), '2026-02-28T18:30:00.000Z'); // 1 Mar 00:00 IST
  assert.strictEqual(p.end.toISOString(), '2026-03-31T18:29:59.999Z');   // 31 Mar 23:59 IST
});

test('a 31 March 23:40 IST spend falls in March, not April', () => {
  const spend = new Date('2026-03-31T18:10:00.000Z');   // 23:40 IST
  const mar = resolveMonth('2026-03');
  const apr = resolveMonth('2026-04');
  assert.ok(spend >= mar.start && spend <= mar.end, 'should be in March');
  assert.ok(!(spend >= apr.start && spend <= apr.end), 'must not be in April');
});

test('month metadata drives the switcher', () => {
  const p = resolveMonth('2026-04');
  assert.strictEqual(p.month, '2026-04');
  assert.strictEqual(p.totalDays, 30);
  assert.strictEqual(p.prev, '2026-03');
  assert.strictEqual(p.next, '2026-05');
  assert.strictEqual(p.shortLabel, "Apr '26");
});

test('a far-future month is flagged so the switcher can disable it', () => {
  assert.strictEqual(resolveMonth('2099-01').isFuture, true);
  assert.strictEqual(resolveMonth('2020-01').isFuture, false);
});

test('a garbage month falls back to the current one instead of throwing', () => {
  assert.strictEqual(resolveMonth('banana').isCurrent, true);
  assert.strictEqual(resolveMonth(undefined).isCurrent, true);
});

/* ── §7 pace ─────────────────────────────────────────────────────── */
test('pace: halfway through the month at 40% spend reads as good', () => {
  const r = paceFor(1200000, 3000000, 15, 30);   // Rs 12k of Rs 30k on day 15
  assert.strictEqual(r.state, 'good');
});

test('pace: exactly on plan reads as on_track', () => {
  assert.strictEqual(paceFor(1500000, 3000000, 15, 30).state, 'on_track');
});

test('pace: spending faster than plan reads as ahead', () => {
  assert.strictEqual(paceFor(2400000, 3000000, 15, 30).state, 'ahead');
});

test('pace: past the budget reads as over, whatever the day', () => {
  assert.strictEqual(paceFor(3100000, 3000000, 20, 30).state, 'over');
});

test('pace: no budget set does not divide by zero', () => {
  const r = paceFor(50000, 0, 10, 30);
  assert.strictEqual(r.state, 'no_budget');
  assert.strictEqual(r.pace, null);
});
