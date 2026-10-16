import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';
import { api } from '../../services/api';
import { triggerHaptic } from '../../utils/haptics';
import PressableScale from '../ui/PressableScale';
import ChatSheet from './chat/ChatSheet';
import { ChatMessage } from './chat/MessageBubble';

type CopilotHandler = (prompt?: string) => void;
let globalOpenCopilot: CopilotHandler | null = null;

export function openCopilot(prompt?: string) {
  if (globalOpenCopilot) {
    globalOpenCopilot(prompt);
  }
}

export default function CopilotDrawer() {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const abortCtrlRef = useRef<AbortController | null>(null);

  const [suggestions, setSuggestions] = useState<string[]>([
    'Can I afford ₹2,000 dinner tonight?',
    'How much spent on Food?',
    'Show my subscriptions',
    'How can I save tax?',
  ]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      source: 'llm',
      content:
        '👋 **Hello! I am NRYN Copilot**, your personal financial AI agent.\n\nAsk me anything! For example: *"Can I afford dinner for ₹2,000 tonight?"*, *"How much did I spend on food?"*, or *"Show my subscriptions"*!',
    },
  ]);

  const handleOpen = () => {
    triggerHaptic('medium');
    setVisible(true);
  };

  const handleClose = () => {
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = null;
    }
    setBusy(false);
    setVisible(false);
  };

  const handleStop = () => {
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = null;
    }
    setBusy(false);
  };

  const handleSend = async (textToSend: string, options: { fromVoice?: boolean } = {}) => {
    const text = textToSend.trim();
    if (!text || busy) return;

    triggerHaptic('light');
    const userMsgId = `user-${Date.now()}`;
    const botMsgId = `bot-${Date.now()}`;

    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      fromVoice: options.fromVoice,
    };

    // Pre-insert bot message placeholder for streaming deltas
    const botPlaceholder: ChatMessage = {
      id: botMsgId,
      role: 'assistant',
      content: '',
      streaming: true,
      fromVoice: options.fromVoice,
      blocks: [],
    };

    setMessages((prev) => [...prev, userMsg, botPlaceholder]);
    setBusy(true);

    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;

    const history = messages
      .filter((m) => m.content.trim().length > 0)
      .slice(-4)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      await api.copilotChatStream(
        text,
        history,
        {
          onDelta: (chunk: string) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId
                  ? { ...m, content: m.content + chunk }
                  : m
              )
            );
          },
          onBlocks: (blocks: any[]) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId
                  ? { ...m, blocks }
                  : m
              )
            );
          },
          onDone: (data) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId
                  ? { ...m, streaming: false, source: (data.source as any) || 'llm' }
                  : m
              )
            );
            if (data.suggestedFollowUps && data.suggestedFollowUps.length > 0) {
              setSuggestions(data.suggestedFollowUps);
            }
          },
          onError: (err) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId
                  ? {
                      ...m,
                      streaming: false,
                      content:
                        m.content.trim() ||
                        'Sorry, I encountered an issue retrieving your live financial metrics. Please try again.',
                    }
                  : m
              )
            );
          },
        },
        ctrl.signal
      );
    } catch {
      // Stream error handled in onError or catch
    } finally {
      setBusy(false);
      abortCtrlRef.current = null;
    }
  };

  React.useEffect(() => {
    globalOpenCopilot = (prompt?: string) => {
      triggerHaptic('medium');
      setVisible(true);
      if (prompt && prompt.trim()) {
        setTimeout(() => {
          handleSend(prompt);
        }, 350);
      }
    };
    return () => {
      globalOpenCopilot = null;
    };
  }, [handleSend]);

  return (
    <ChatSheet
      visible={visible}
      onClose={handleClose}
      messages={messages}
      busy={busy}
      onSend={handleSend}
      onStop={handleStop}
      suggestions={suggestions}
    />
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    bottom: 96,
    right: 20,
    zIndex: 999,
  },
  floatingFab: {
    borderRadius: 28,
  },
  gradientOrb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
