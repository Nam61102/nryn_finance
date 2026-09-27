'use strict';
const env = require('../config/env');

/**
 * OpenRouter → Groq → OpenAI fallback chain (copied from nryn-mail).
 * Disabled entirely unless LLM_FALLBACK_ENABLED=true, so the whole system can
 * run regex-only and nothing leaves your machine (§9).
 */
const PROVIDERS = [
  { name: 'openrouter', key: () => env.llm.openrouterKey, url: 'https://openrouter.ai/api/v1/chat/completions', model: () => env.llm.model },
  { name: 'groq',       key: () => env.llm.groqKey,       url: 'https://api.groq.com/openai/v1/chat/completions', model: () => 'llama-3.3-70b-versatile' },
  { name: 'openai',     key: () => env.llm.openaiKey,     url: 'https://api.openai.com/v1/chat/completions', model: () => 'gpt-4o-mini' },
];

const isEnabled = () => env.capabilities.llmFallback;

async function chatJSON(system, user, { timeoutMs = 15000 } = {}) {
  if (!isEnabled()) {
    const err = new Error('LLM fallback disabled');
    err.code = 'LLM_DISABLED';
    err.missing = env.missingFor('llm');
    throw err;
  }

  let lastErr;
  for (const p of PROVIDERS) {
    const key = p.key();
    if (!key) continue;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          ...(p.name === 'openrouter' ? { 'HTTP-Referer': 'https://nryn-finance-wqtv.onrender.com', 'X-Title': 'NRYN Finance' } : {}),
        },
        body: JSON.stringify({
          model: p.model(),
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
      });
      if (!res.ok) throw new Error(`${p.name} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error(`${p.name}: empty completion`);
      return { provider: p.name, json: JSON.parse(text) };
    } catch (err) {
      lastErr = err;
      console.warn(`  llm     ${p.name} failed: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error('no LLM provider configured');
}

module.exports = { chatJSON, isEnabled };
