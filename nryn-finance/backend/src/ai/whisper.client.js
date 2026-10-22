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

const DEVANAGARI_DIGITS_MAP = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
};

function normalizeDigits(str = '') {
  return str.replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS_MAP[d] || d);
}

/**
 * Common English words phonetically transliterated into Devanagari by some STT engines.
 * If detected, we reconstruct the genuine English Latin sentence.
 */
const DEVANAGARI_ENGLISH_MAP = {
  // Auxiliary & Pronouns
  'कॅन': 'can',
  'कैन': 'can',
  'आय': 'I',
  'एम': 'am',
  'इज': 'is',
  'आर': 'are',
  'यू': 'you',
  'वी': 'we',
  'दे': 'they',
  'माय': 'my',
  'मी': 'me',
  // Verbs & Actions
  'अफोर्ड': 'afford',
  'अफोर्डेबल': 'affordable',
  'स्पेंड': 'spend',
  'स्पेंट': 'spent',
  'बाय': 'buy',
  'पे': 'pay',
  'पेड': 'paid',
  'शो': 'show',
  'टेल': 'tell',
  'चेक': 'check',
  'सेव्ह': 'save',
  'डू': 'do',
  'डिड': 'did',
  'हॅव': 'have',
  'गेट': 'get',
  // Financial terms
  'रूपीज': 'rupees',
  'रुपीज': 'rupees',
  'रुपीस': 'rupees',
  'रुपिज': 'rupees',
  'बजेट': 'budget',
  'मनी': 'money',
  'टॅक्स': 'tax',
  'टैक्स': 'tax',
  'लिमिट': 'limit',
  'सेफ': 'safe',
  'सबस्क्रिप्शन': 'subscription',
  'सबस्क्रिप्शन्स': 'subscriptions',
  'ट्रान्झॅक्शन': 'transaction',
  'ट्रान्झॅक्शन्स': 'transactions',
  'लोन': 'loan',
  'ईएमआय': 'EMI',
  // Daily life & dining
  'डिनर': 'dinner',
  'लंच': 'lunch',
  'ब्रेकफास्ट': 'breakfast',
  'फूड': 'food',
  'हॉटेल': 'hotel',
  'पार्टी': 'party',
  'शूज': 'shoes',
  'क्लॉथ्स': 'clothes',
  // Time words
  'टूनाईट': 'tonight',
  'टुनाइट': 'tonight',
  'टुनाईट': 'tonight',
  'टुडे': 'today',
  'टुडेज': "today's",
  'यस्टरडे': 'yesterday',
  'टुमारो': 'tomorrow',
  'मंथ': 'month',
  'लास्ट': 'last',
  'धिस': 'this',
  'नेक्स्ट': 'next',
  // Interrogatives & prepositions
  'हाऊ': 'how',
  'हाउ': 'how',
  'मच': 'much',
  'व्हॉट': 'what',
  'व्हेन': 'when',
  'व्हेअर': 'where',
  'ऑन': 'on',
  'इन': 'in',
  'फॉर': 'for',
  'द': 'the',
};

/**
 * Detects if a Devanagari string is actually transliterated English phonetics
 * (e.g. "कॅन आय अफोर्ड 2000 रूपीज डिनर टूनाईट"). If so, reconstructs clean English.
 */
function normalizeTransliteratedEnglish(text = '') {
  const str = text.trim();
  if (!str) return { text: '', isTransliterated: false };

  // Only check if text contains Devanagari characters
  if (!/[\u0900-\u097F]/.test(str)) {
    return { text: str, isTransliterated: false };
  }

  const rawWords = str.split(/\s+/);
  let matchedEnglishCount = 0;
  let devanagariWordCount = 0;

  const convertedWords = rawWords.map((word) => {
    // Strip trailing punctuation
    const cleanWord = word.replace(/[?!.,;:]/g, '');
    const hasDev = /[\u0900-\u097F]/.test(cleanWord);
    if (hasDev) devanagariWordCount++;

    const lower = cleanWord.toLowerCase();
    if (DEVANAGARI_ENGLISH_MAP[lower]) {
      matchedEnglishCount++;
      return DEVANAGARI_ENGLISH_MAP[lower];
    }
    // Numbers or English words stay as is
    return cleanWord;
  });

  // If 2 or more transliterated English words, or starts with "can I" / "how much",
  // and majority of Devanagari words matched:
  const firstLower = rawWords[0]?.replace(/[?!.,;:]/g, '').toLowerCase();
  const startsWithEnglishPattern =
    firstLower === 'कॅन' || firstLower === 'कैन' || firstLower === 'हाऊ' || firstLower === 'हाउ' || firstLower === 'शो';

  if (
    (matchedEnglishCount >= 2 && devanagariWordCount > 0 && matchedEnglishCount / devanagariWordCount >= 0.4) ||
    (startsWithEnglishPattern && matchedEnglishCount >= 1)
  ) {
    let result = convertedWords.join(' ');
    result = result.charAt(0).toUpperCase() + result.slice(1);
    if (!/[?.!]$/.test(result)) {
      result += '?';
    }
    return { text: result, isTransliterated: true };
  }

  return { text: str, isTransliterated: false };
}

/**
 * Detect language script from text (Devanagari vs Latin) and classify
 * between Marathi, Hindi, and English.
 */
function detectLanguage(text = '') {
  const str = text.trim();
  if (!str) return { code: 'en', name: 'English' };

  // 1. Check if it's transliterated English
  const translitCheck = normalizeTransliteratedEnglish(str);
  if (translitCheck.isTransliterated) {
    return { code: 'en', name: 'English' };
  }

  // 2. Check for Devanagari Unicode block (\u0900-\u097F)
  const hasDevanagari = /[\u0900-\u097F]/.test(str);
  if (!hasDevanagari) {
    // Latin script - check for phonetic Marathi vs Hinglish vs English
    if (/\b(?:kiti|kharch|jhala|jhale|jhali|aahe|aahet|nahi|shillak|gheu|shakto|shakte|paise|mahina|parwadel|dakhva|sanga)\b/i.test(str)) {
      return { code: 'mr', name: 'Marathi (Latin)' };
    }
    if (/\b(?:kitna|kharcha|hua|hue|hui|hai|hain|nahi|bacha|kar|sakta|sakti|paisa|pe|batao|dikhao|karo)\b/i.test(str)) {
      return { code: 'hi', name: 'Hinglish' };
    }
    return { code: 'en', name: 'English' };
  }

  // 3. Devanagari script: Distinct Marathi marker words
  const isMarathi = /(?:आहे|आहेत|नाही|झाला|झाली|झाले|केला|केली|केले|किती|शिल्लक|परवडेल|परवडतील|शकतो|शकते|शकू|होईल|पाहिजे|सांगा|सांग|दाखवा|दाखव|जेवण|खाण्या|महिना|पैसे|बघू|बघ|चालू|आता|इथे|माझे|माझा|माझी|मला|तुम्ही|आपण|\bका\b)/.test(str);

  // 4. Devanagari script: Distinct Hindi marker words
  const isHindi = /(?:है|हैं|नहीं|हुआ|हुए|हुई|किया|किए|कितना|कितनी|कितने|बचा|बची|बचे|सकता|सकती|सकते|होगा|होगी|होंगे|चाहिए|बताओ|बताइए|दिखाओ|दिखाइए|खाना|क्या|मुझे|मेरा|मेरी|मेरे|किसे|कहाँ|हूँ)/.test(str);

  if (isMarathi && !isHindi) {
    return { code: 'mr', name: 'Marathi' };
  }
  if (isHindi && !isMarathi) {
    return { code: 'hi', name: 'Hindi' };
  }
  if (isMarathi && isHindi) {
    const mrScore = (str.match(/(?:आहे|आहेत|नाही|झाला|झाली|झाले|केला|किती|शिल्लक|परवडेल|परवडतील|शकतो|शकते|सांगा|दाखवा|मला|माझे|माझा|माझी|\bका\b)/g) || []).length;
    const hiScore = (str.match(/(?:है|हैं|नहीं|हुआ|हुए|किया|कितना|बचा|बचे|सकता|होगा|चाहिए|बताओ|दिखाओ|क्या|मुझे|मेरा|मेरी|मेरे)/g) || []).length;
    return mrScore >= hiScore ? { code: 'mr', name: 'Marathi' } : { code: 'hi', name: 'Hindi' };
  }

  // Default Devanagari when ambiguous to Marathi (since NRYN's primary user base is in MH)
  return { code: 'mr', name: 'Marathi' };
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
              'You are an expert audio speech-to-text transcriber for the NRYN personal finance app.\n\n' +
              'CRITICAL SCRIPT & LANGUAGE RULES:\n' +
              '1. Listen carefully to what language the user spoke:\n' +
              '   - If the user spoke in ENGLISH (even with an Indian accent, or mentioning rupees, UPI, dinner, budget, etc.):\n' +
              '     Transcribe strictly in standard ENGLISH using the standard LATIN ALPHABET (e.g. "Can I afford 2000 rupees dinner tonight?").\n' +
              '     NEVER EVER transliterate English into Devanagari script! NEVER write "कॅन आय अफोर्ड". Always output English words in Latin alphabet.\n' +
              '   - If the user spoke in MARATHI (मराठी):\n' +
              '     Transcribe in MARATHI using DEVANAGARI script (e.g. "मला आज २००० रुपये खर्च परवडेल का?").\n' +
              '   - If the user spoke in HINDI (हिंदी):\n' +
              '     Transcribe in HINDI using DEVANAGARI script (e.g. "क्या मैं आज २००० रुपये खर्च कर सकता हूँ?").\n' +
              '   - If the user spoke in HINGLISH (Hindi words in English alphabet):\n' +
              '     Transcribe verbatim in Latin script (e.g. "Mera aaj kitna kharcha hua?").\n' +
              '2. Output ONLY the raw spoken words verbatim. Do NOT translate. Do NOT answer the query. Do NOT add conversational responses or markdown.\n' +
              '3. If there is no speech or only silence in the audio, respond with exactly: EMPTY_AUDIO',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcribe the spoken audio verbatim in its original spoken language (English in Latin alphabet, Marathi/Hindi in Devanagari script):',
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

  const defaultPrompt = prompt || 'English, Marathi, Hindi personal finance questions, budget, expenses, UPI, rupees, dinner';

  // 1. Try Groq Whisper if key exists (fastest whisper endpoint)
  if (env.llm.groqKey) {
    try {
      let rawText = await transcribeWithWhisper(
        { name: 'groq', model: 'whisper-large-v3', url: 'https://api.groq.com/openai/v1/audio/transcriptions' },
        buffer, filename, mimeType, env.llm.groqKey, defaultPrompt, timeoutMs
      );
      rawText = normalizeDigits(rawText);
      const translitCheck = normalizeTransliteratedEnglish(rawText);
      const text = translitCheck.text;
      const detected = translitCheck.isTransliterated ? { code: 'en', name: 'English' } : detectLanguage(text);

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
      let rawText = await transcribeWithOpenRouter(buffer, mimeType, env.llm.openrouterKey, defaultPrompt, timeoutMs);
      rawText = normalizeDigits(rawText);
      const translitCheck = normalizeTransliteratedEnglish(rawText);
      const text = translitCheck.text;
      const detected = translitCheck.isTransliterated ? { code: 'en', name: 'English' } : detectLanguage(text);

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
      let rawText = await transcribeWithWhisper(
        { name: 'openai', model: 'whisper-1', url: 'https://api.openai.com/v1/audio/transcriptions' },
        buffer, filename, mimeType, env.llm.openaiKey, defaultPrompt, timeoutMs
      );
      rawText = normalizeDigits(rawText);
      const translitCheck = normalizeTransliteratedEnglish(rawText);
      const text = translitCheck.text;
      const detected = translitCheck.isTransliterated ? { code: 'en', name: 'English' } : detectLanguage(text);

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
  normalizeTransliteratedEnglish,
  normalizeDigits,
};
