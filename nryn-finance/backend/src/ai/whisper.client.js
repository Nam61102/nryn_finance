'use strict';
const env = require('../config/env');

/**
 * Speech-to-Text client using Groq Whisper (ultra low-latency) with OpenAI fallback.
 * Supports Marathi (mr), Hindi (hi), and English (en).
 */

const PROVIDERS = [
  {
    name: 'groq',
    key: () => env.llm.groqKey,
    url: 'https://api.groq.com/openai/v1/audio/transcriptions',
    model: 'whisper-large-v3',
  },
  {
    name: 'openai',
    key: () => env.llm.openaiKey,
    url: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1',
  },
];

/**
 * Detect language script from text (Devanagari vs Latin) and classify
 * between Marathi, Hindi, and English.
 */
function detectLanguage(text = '') {
  const str = text.trim();
  if (!str) return { code: 'en', name: 'English' };

  // Devanagari range: \u0900-\u097F
  const hasDevanagari = /[\u0900-\u097F]/.test(str);
  if (!hasDevanagari) {
    // Check for phonetic Hinglish / Marathi words
    if (/\b(?:kiti|kharch|jhala|aahe|nahi|shillak|gheu|shakto|paise|kiti|mahina)\b/i.test(str)) {
      return { code: 'mr', name: 'Marathi (Latin)' };
    }
    if (/\b(?:kitna|kharcha|hua|hai|nahi|bacha|kar|sakta|paisa|pe|aaj)\b/i.test(str)) {
      return { code: 'hi', name: 'Hinglish' };
    }
    return { code: 'en', name: 'English' };
  }

  // Common Marathi marker words in Devanagari
  if (/(?:आहे|नाही|झाला|केला|किती|खर्च|शिल्लक|परवडेल|शकतो|महिना|जेवण|पैसे|होईल)/.test(str)) {
    return { code: 'mr', name: 'Marathi' };
  }

  // Common Hindi marker words in Devanagari
  if (/(?:है|नहीं|हुआ|किया|कितना|खर्चा|बचा|सकता|महीना|खाना|पैसे|होगा)/.test(str)) {
    return { code: 'hi', name: 'Hindi' };
  }

  // Default Devanagari to Hindi
  return { code: 'hi', name: 'Hindi' };
}

/**
 * Transcribe an audio buffer (e.g. from multer) using Whisper API.
 * @param {Buffer} buffer - Audio file buffer
 * @param {string} filename - e.g. "audio.m4a" or "audio.wav"
 * @param {string} mimeType - e.g. "audio/m4a"
 * @param {Object} options - { timeoutMs?: number, prompt?: string }
 */
async function transcribeAudio(buffer, filename = 'audio.m4a', mimeType = 'audio/m4a', { timeoutMs = 20000, prompt = '' } = {}) {
  let lastErr = null;

  for (const p of PROVIDERS) {
    const key = p.key();
    if (!key) continue;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      // Use native Node 20 FormData & Blob
      const formData = new FormData();
      const blob = new Blob([buffer], { type: mimeType });
      formData.append('file', blob, filename);
      formData.append('model', p.model);
      formData.append('response_format', 'json');
      if (prompt) {
        formData.append('prompt', prompt);
      }

      const res = await fetch(p.url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${key}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`${p.name} Whisper ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const text = (data?.text || '').trim();
      const detected = detectLanguage(text);

      return {
        ok: true,
        provider: p.name,
        text,
        language: detected.code,
        languageName: detected.name,
      };
    } catch (err) {
      lastErr = err;
      console.warn(`  whisper ${p.name} failed: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  // If no STT API key is available or network fails, throw structured error
  const err = new Error(lastErr?.message || 'No Whisper STT provider configured. Set GROQ_API_KEY or OPENAI_API_KEY.');
  err.code = 'STT_UNAVAILABLE';
  throw err;
}

module.exports = {
  transcribeAudio,
  detectLanguage,
};
