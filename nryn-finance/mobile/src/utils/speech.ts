import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

/**
 * Detect language script and return appropriate BCP-47 locale code.
 * Supports Marathi (mr-IN), Hindi (hi-IN), and Indian English (en-IN).
 */
export function detectVoiceLanguage(text: string): 'mr-IN' | 'hi-IN' | 'en-IN' {
  const str = text.trim();
  if (!str) return 'en-IN';

  // Check for Devanagari Unicode block (\u0900-\u097F)
  const hasDevanagari = /[\u0900-\u097F]/.test(str);
  if (!hasDevanagari) {
    // If Latin script matches Marathi phonetic keywords
    if (/\b(?:kiti|kharch|jhala|aahe|nahi|shillak|gheu|shakto|paise|mahina)\b/i.test(str)) {
      return 'mr-IN';
    }
    // If Latin script matches Hindi/Hinglish keywords
    if (/\b(?:kitna|kharcha|hua|hai|nahi|bacha|kar|sakta|paisa|pe|aaj)\b/i.test(str)) {
      return 'hi-IN';
    }
    return 'en-IN';
  }

  // Common Marathi marker words in Devanagari
  if (/(?:आहे|नाही|झाला|केला|किती|खर्च|शिल्लक|परवडेल|शकतो|महिना|जेवण|पैसे|होईल|बजेट|होय)/.test(str)) {
    return 'mr-IN';
  }

  // Common Hindi marker words in Devanagari
  if (/(?:है|नहीं|हुआ|किया|कितना|खर्चा|बचा|सकता|महीना|खाना|पैसे|होगा|बजट|हाँ)/.test(str)) {
    return 'hi-IN';
  }

  // Default Devanagari to Hindi
  return 'hi-IN';
}

/**
 * Strip markdown syntax, headers, URLs, and decorative emojis so text
 * sounds completely natural when read by the on-device TTS engine.
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';

  return (
    text
      // Strip markdown code blocks & inline code
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Strip markdown bold and italics
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Strip markdown headers
      .replace(/^#{1,6}\s+/gm, '')
      // Strip bullet points and list markers
      .replace(/^[\*\-\+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      // Strip markdown links [title](url) -> title
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Clean decorative financial and UI emojis so speech doesn't awkwardly say "fire emoji", "hamburger" etc.
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      // Normalize excessive whitespace and line breaks
      .replace(/\n+/g, '. ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}

export interface SpeakOptions {
  language?: 'mr-IN' | 'hi-IN' | 'en-IN';
  rate?: number;
  pitch?: number;
  onDone?: () => void;
  onError?: (err: Error) => void;
  onStopped?: () => void;
}

/**
 * Speaks the given text using on-device native speech synthesis.
 * Automatically selects mr-IN, hi-IN, or en-IN unless explicitly provided.
 */
export async function speakText(text: string, options: SpeakOptions = {}): Promise<void> {
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return;

  try {
    // Stop any speech currently in progress
    await stopSpeech();

    const targetLanguage = options.language || detectVoiceLanguage(text);

    Speech.speak(cleaned, {
      language: targetLanguage,
      rate: options.rate ?? 0.95, // Slightly gentler rate for clear Indian diction
      pitch: options.pitch ?? 1.0,
      onDone: options.onDone,
      onError: (err) => {
        if (options.onError) {
          options.onError(err instanceof Error ? err : new Error(String(err)));
        }
      },
      onStopped: options.onStopped,
    });
  } catch (err) {
    if (options.onError && err instanceof Error) {
      options.onError(err);
    }
  }
}

/**
 * Immediately stop speech playback.
 */
export async function stopSpeech(): Promise<void> {
  try {
    const isSpeaking = await Speech.isSpeakingAsync().catch(() => false);
    if (isSpeaking) {
      Speech.stop();
    }
  } catch {
    // Graceful no-op on platforms without speech synthesis
  }
}

/**
 * Check if the engine is currently speaking.
 */
export async function isSpeaking(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
