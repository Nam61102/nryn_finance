import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import { useTheme } from '../../../theme';
import MessageBubble, { ChatMessage } from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import SuggestionChips from './SuggestionChips';
import ChatInput from './ChatInput';

interface ChatSheetProps {
  visible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  busy: boolean;
  onSend: (text: string, options?: { fromVoice?: boolean }) => void;
  onStop: () => void;
  suggestions: string[];
}

export default function ChatSheet({
  visible,
  onClose,
  messages,
  busy,
  onSend,
  onStop,
  suggestions,
}: ChatSheetProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll on messages change
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, visible, busy]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity
          style={styles.dismissOverlay}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bg,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          {/* Grab Handle */}
          <View style={styles.handleWrap}>
            <View
              style={[
                styles.handle,
                { backgroundColor: theme.isDark ? '#334155' : '#CBD5E1' },
              ]}
            />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.titleGroup}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: theme.colors.accentLight },
                ]}
              >
                <Sparkles size={18} color={theme.colors.accent} />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  NRYN Copilot
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.textDim }]}>
                  AI Financial Assistant · Live Indian FinTech
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.colors.card }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Messages list */}
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onCloseSheet={onClose}
              />
            ))}
            {busy && <TypingIndicator />}
          </ScrollView>

          {/* Suggestion Chips */}
          <SuggestionChips
            suggestions={suggestions}
            onSelect={onSend}
            disabled={busy}
          />

          {/* Chat Input */}
          <ChatInput onSend={onSend} onStop={onStop} busy={busy} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  dismissOverlay: {
    flex: 1,
  },
  sheet: {
    height: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
});
