'use strict';
const { chatJSON } = require('./llm.client');
const { SYSTEM, user } = require('./prompts/extract.prompt');
const N = require('../parse/normalize');

/**
 * LLM fallback, used ONLY when every regex missed. Digits are redacted before
 * the prompt is built, so no full account or card number leaves the machine.
 */
async function extractWithLLM(body, ctx) {
  const safeBody = N.redact(body);
  const { json, provider } = await chatJSON(SYSTEM, user(safeBody));

  const amount = json.amount === null || json.amount === undefined ? null : N.toPaise(json.amount);
  const direction = json.direction === 'debit' || json.direction === 'credit' ? json.direction : null;
  if (amount === null || !direction) return null;

  let occurredAt = ctx.receivedAt;
  if (json.date) {
    const d = new Date(`${json.date}T00:00:00+05:30`);
    if (!Number.isNaN(d.getTime())) occurredAt = d;
  }

  return {
    amount,
    direction,
    occurredAt,
    merchantRaw: json.merchant || null,
    last4: json.last4 || null,
    refId: json.refId || null,
    method: json.method || 'unknown',
    balanceAfter: null,
    bankName: null,
    accountType: 'savings',
    parserUsed: `llm:${provider}`,
    confidence: typeof json.confidence === 'number' ? json.confidence : 0.5,
  };
}

module.exports = { extractWithLLM };
