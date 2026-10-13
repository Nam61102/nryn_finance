import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sparkles, Copy, Check, Volume2, Square, Mic } from 'lucide-react-native';
import { useTheme } from '../../../theme';
import { speakText, stopSpeech, isSpeaking } from '../../../utils/speech';
import BlockRenderer from './blocks';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'llm' | 'rules';
  blocks?: any[];
  suggestedFollowUps?: string[];
  streaming?: boolean;
  fromVoice?: boolean;
}

interface MessageBubbleProps {
  message: ChatMessage;
  onCloseSheet?: () => void;
}

export default function MessageBubble({ message, onCloseSheet }: MessageBubbleProps) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const autoSpokenRef = useRef(false);
  const isUser = message.role === 'user';

  // Option A: Auto-play speech only if user asked their query using voice
  useEffect(() => {
    if (
      message.fromVoice &&
      !message.streaming &&
      message.content.trim() &&
      !autoSpokenRef.current
    ) {
      autoSpokenRef.current = true;
      setSpeaking(true);
      speakText(message.content, {
        onDone: () => setSpeaking(false),
        onError: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
      });
    }
  }, [message.fromVoice, message.streaming, message.content]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      if (speaking) {
        stopSpeech().catch(() => {});
      }
    };
  }, [speaking]);

  const copyToClipboard = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleToggleSpeech = async () => {
    if (speaking) {
      await stopSpeech();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      speakText(message.content, {
        onDone: () => setSpeaking(false),
        onError: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
      });
    }
  };

  if (isUser) {
    return (
      <View style={[styles.userBubble, { backgroundColor: theme.colors.accent }]}>
        <View style={styles.userContentRow}>
          {message.fromVoice && (
            <Mic size={14} color="#0B0F0D" style={styles.userMicIcon} />
          )}
          <Text style={styles.userText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistantWrap}>
      {/* AI Badge & Audio Header */}
      <View style={styles.badgeRow}>
        <View style={[styles.aiPill, { backgroundColor: theme.colors.accentLight }]}>
          <Sparkles size={11} color={theme.colors.accent} />
          <Text style={[styles.aiPillText, { color: theme.colors.accent }]}>
            {message.source === 'llm' ? 'NRYN AI' : 'Live State'}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          {/* Speaker button (Play / Stop spoken audio) */}
          {!message.streaming && message.content.trim().length > 0 && (
            <TouchableOpacity
              onPress={handleToggleSpeech}
              style={[
                styles.iconBtn,
                speaking && { backgroundColor: theme.colors.accentLight },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {speaking ? (
                <Square size={12} color={theme.colors.accent} fill={theme.colors.accent} />
              ) : (
                <Volume2 size={13} color={theme.colors.textDim} />
              )}
            </TouchableOpacity>
          )}

          {/* Copy Button */}
          <TouchableOpacity
            onPress={copyToClipboard}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {copied ? (
              <Check size={12} color="#10B981" />
            ) : (
              <Copy size={12} color={theme.colors.textDim} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Bubble text */}
      <View
        style={[
          styles.assistantBubble,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.isDark ? '#23304A' : '#E2E8F0',
          },
        ]}
      >
        <Text style={[styles.assistantText, { color: theme.colors.text }]}>
          {message.content}
        </Text>

        {/* Server-side Deterministic Rich Blocks */}
        {message.blocks && message.blocks.length > 0 && (
          <BlockRenderer blocks={message.blocks} onCloseSheet={onCloseSheet} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    marginVertical: 4,
  },
  userContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userMicIcon: {
    marginRight: 2,
  },
  userText: {
    color: '#0B0F0D',
    fontSize: 14,
    fontWeight: '600',
  },
  assistantWrap: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    width: '92%',
    marginVertical: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  aiPillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    padding: 3,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantBubble: {
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  assistantText: {
    fontSize: 14,
    lineHeight: 21,
  },
});
