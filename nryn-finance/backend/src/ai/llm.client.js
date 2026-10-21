'use strict';
const env = require('../config/env');

/**
 * OpenRouter → Groq → OpenAI fallback chain (copied from nryn-mail).
 * Controlled by LLM_FALLBACK_ENABLED (for SMS parsing) and COPILOT_LLM_ENABLED (for Copilot chat).
 */
const PROVIDERS = [
  { name: 'openrouter', key: () => env.llm.openrouterKey, url: 'https://openrouter.ai/api/v1/chat/completions', model: () => env.llm.model },
  { name: 'groq',       key: () => env.llm.groqKey,       url: 'https://api.groq.com/openai/v1/chat/completions', model: () => 'llama-3.3-70b-versatile' },
  { name: 'openai',     key: () => env.llm.openaiKey,     url: 'https://api.openai.com/v1/chat/completions', model: () => 'gpt-4o-mini' },
];

const isEnabled = () => env.capabilities.llmFallback;
const isCopilotEnabled = () => env.capabilities.copilotLlm;

async function chatMessages(messages, { timeoutMs = 15000, forCopilot = false } = {}) {
  const allowed = forCopilot ? isCopilotEnabled() : isEnabled();
  if (!allowed) {
    const err = new Error(forCopilot ? 'Copilot LLM disabled' : 'LLM fallback disabled');
    err.code = forCopilot ? 'COPILOT_LLM_DISABLED' : 'LLM_DISABLED';
    err.missing = env.missingFor(forCopilot ? 'copilotLlm' : 'llm');
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
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages,
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

async function chatStream(messages, onChunk, { timeoutMs = 20000, forCopilot = true } = {}) {
  const allowed = forCopilot ? isCopilotEnabled() : isEnabled();
  if (!allowed) {
    const err = new Error(forCopilot ? 'Copilot LLM disabled' : 'LLM fallback disabled');
    err.code = forCopilot ? 'COPILOT_LLM_DISABLED' : 'LLM_DISABLED';
    err.missing = env.missingFor(forCopilot ? 'copilotLlm' : 'llm');
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
          temperature: 0.2,
          stream: true,
          messages,
        }),
      });
      if (!res.ok) throw new Error(`${p.name} ${res.status}: ${(await res.text()).slice(0, 200)}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') return { provider: p.name };
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const delta = data?.choices?.[0]?.delta?.content;
              if (delta) onChunk(delta);
            } catch (_) {}
          }
        }
      }
      return { provider: p.name };
    } catch (err) {
      lastErr = err;
      console.warn(`  llm stream ${p.name} failed: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error('no LLM provider configured');
}

async function chatJSON(system, user, options = {}) {
  return chatMessages([{ role: 'system', content: system }, { role: 'user', content: user }], options);
}

module.exports = { chatJSON, chatMessages, chatStream, isEnabled, isCopilotEnabled };

