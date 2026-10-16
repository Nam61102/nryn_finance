'use strict';
const env = require('../config/env');

/**
 * Speech-to-Text client for NRYN Finance Copilot.
 * Multilingual support: Marathi (mr), Hindi (hi), Hinglish, and English (en).
 * Supported Providers:
 * 1. OpenRouter (Google Gemini 2.5 Flash Multimodal Audio) - High precision for Indian languages
 * 2. Groq Whisper (whisper-large-v3) - Ultra low-latency
 * 3. OpenAI Whisper (whisper-1)
 */

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
    if (/\b(?:kiti|kharch|jhala|jhale|aahe|shillak|gheu|shakto|paise|mahina)\b/i.test(str)) {
      return { code: 'mr', name: 'Marathi (Latin)' };
    }
    if (/\b(?:kitna|kharcha|hua|hue|hai|bacha|kar|sakta|paisa|pe|batao)\b/i.test(str)) {
      return { code: 'hi', name: 'Hinglish' };
    }
    return { code: 'en', name: 'English' };
  }

  // Common Hindi marker words in Devanagari (check Hindi first to avoid overlap on shared terms)
  if (/(?:है|नहीं|हुआ|हुए|किया|कितना|बचा|सकता|होगा|चाहिए|बताओ|खाना)/.test(str)) {
    return { code: 'hi', name: 'Hindi' };
  }

  // Common Marathi marker words in Devanagari
  if (/(?:आहे|नाही|झाला|झाले|केला|किती|शिल्लक|परवडेल|शकतो|होईल|पाहिजे|सांगा|जेवण|महिना)/.test(str)) {
    return { code: 'mr', name: 'Marathi' };
  }

  // Default Devanagari to Hindi
  return { code: 'hi', name: 'Hindi' };
}

/**
 * Transcribe via OpenRouter Gemini Multimodal Audio
 */
async function transcribeWithOpenRouter(buffer, mimeType, key, prompt = '', timeoutMs = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const base64Audio = buffer.toString('base64');
    let cleanMime = mimeType || 'audio/m4a';
    if (!cleanMime.startsWith('audio/')) {
      cleanMime = 'audio/m4a';
    }

    const audioDataUrl = `data:${cleanMime};base64,${base64Audio}`;

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nrynfinance.in',
        'X-Title': 'NRYN Finance Copilot Voice',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0.0,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert audio speech-to-text transcriber for the NRYN personal finance app. ' +
              'Your job is to transcribe the user\'s spoken words verbatim in Marathi, Hindi, Hinglish, or English.\n\n' +
              'RULES:\n' +
              '1. Output ONLY the raw spoken text verbatim.\n' +
              '2. If spoken in Marathi or Hindi, output Devanagari script.\n' +
              '3. Do NOT add conversational responses, questions, or markdown.\n' +
              '4. If there is no speech or only silence in the audio, respond with exactly: EMPTY_AUDIO',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt ? `Context: ${prompt}. Transcribe spoken audio:` : 'Transcribe this spoken audio verbatim:',
              },
              {
                type: 'image_url',
                image_url: {
                  url: audioDataUrl,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    let text = (data?.choices?.[0]?.message?.content || '').trim();
    if (text.toUpperCase() === 'EMPTY_AUDIO' || text.toUpperCase() === 'EMPTY_AUDIO.') {
      text = '';
    }
    // Strip leading/trailing quotes if any
    text = text.replace(/^["'«»„“]+|["'«»„”]+$/g, '').trim();
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Transcribe via standard Whisper REST API (Groq / OpenAI)
 */
async function transcribeWithWhisper(provider, buffer, filename, mimeType, key, prompt = '', timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, filename);
    formData.append('model', provider.model);
    formData.append('response_format', 'json');
    if (prompt) {
      formData.append('prompt', prompt);
    }

    const res = await fetch(provider.url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`${provider.name} Whisper ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    return (data?.text || '').trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Transcribe an audio buffer using OpenRouter (Gemini Multimodal), Groq Whisper, or OpenAI Whisper.
 * @param {Buffer} buffer - Audio file buffer
 * @param {string} filename - e.g. "audio.m4a" or "audio.wav"
 * @param {string} mimeType - e.g. "audio/m4a"
 * @param {Object} options - { timeoutMs?: number, prompt?: string }
 */
async function transcribeAudio(buffer, filename = 'audio.m4a', mimeType = 'audio/m4a', { timeoutMs = 25000, prompt = '' } = {}) {
  let lastErr = null;

  // If buffer is tiny / empty
  if (!buffer || buffer.length < 500) {
    return {
      ok: true,
      provider: 'empty',
      text: '',
      language: 'mr',
      languageName: 'Marathi',
    };
  }

  // 1. Try Groq Whisper if key exists (fastest whisper endpoint)
  if (env.llm.groqKey) {
    try {
      const text = await transcribeWithWhisper(
        { name: 'groq', model: 'whisper-large-v3', url: 'https://api.groq.com/openai/v1/audio/transcriptions' },
        buffer, filename, mimeType, env.llm.groqKey, prompt, timeoutMs
      );
      const detected = detectLanguage(text);
      return {
        ok: true,
        provider: 'groq',
        text,
        language: detected.code,
        languageName: detected.name,
      };
    } catch (err) {
      lastErr = err;
      console.warn('  Groq Whisper failed:', err.message);
    }
  }

  // 2. Try OpenRouter Gemini (high accuracy for Marathi, Hindi, English, and active on Render)
  if (env.llm.openrouterKey) {
    try {
      const text = await transcribeWithOpenRouter(buffer, mimeType, env.llm.openrouterKey, prompt, timeoutMs);
      const detected = detectLanguage(text);
      return {
        ok: true,
        provider: 'openrouter-gemini',
        text,
        language: detected.code,
        languageName: detected.name,
      };
    } catch (err) {
      lastErr = err;
      console.warn('  OpenRouter audio transcription failed:', err.message);
    }
  }

  // 3. Try OpenAI Whisper if key exists
  if (env.llm.openaiKey) {
    try {
      const text = await transcribeWithWhisper(
        { name: 'openai', model: 'whisper-1', url: 'https://api.openai.com/v1/audio/transcriptions' },
        buffer, filename, mimeType, env.llm.openaiKey, prompt, timeoutMs
      );
      const detected = detectLanguage(text);
      return {
        ok: true,
        provider: 'openai',
        text,
        language: detected.code,
        languageName: detected.name,
      };
    } catch (err) {
      lastErr = err;
      console.warn('  OpenAI Whisper failed:', err.message);
    }
  }

  const err = new Error(lastErr?.message || 'No Speech-to-Text provider configured. Set OPENROUTER_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY.');
  err.code = 'STT_UNAVAILABLE';
  throw err;
}

module.exports = {
  transcribeAudio,
  detectLanguage,
};
