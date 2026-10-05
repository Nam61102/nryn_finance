import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { theme } from '../../theme';
import { api } from '../../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  insights?: any;
  suggestedFollowUps?: string[];
}

export default function CopilotDrawer() {
  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        '👋 **Hello! I am NRYN Copilot**, your personal financial AI agent.\n\nAsk me anything! For example: *"Can I afford dinner for ₹2,000 tonight?"*, *"How much did I spend on food?"*, or *"Show my subscriptions"*!',
      suggestedFollowUps: [
        'Can I afford ₹2,000 dinner tonight?',
        'How much spent on Food?',
        'Show my subscriptions',
        'How can I save tax?',
      ],
    },
  ]);

  const send = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || busy) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setBusy(true);

    try {
      const history = messages.slice(-4).map((m) => ({ role: m.role, content: m.content }));
      const res = await api.copilotChat(text, history);

      const botMsg: Message = {
        role: 'assistant',
        content: res.reply || 'Here is your financial update.',
        insights: res.insights,
        suggestedFollowUps: res.suggestedFollowUps,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an issue fetching your live state. Please try again.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating Copilot Launcher Orb */}
      <TouchableOpacity
        style={styles.floatingFab}
        onPress={() => setVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>✨</Text>
        <Text style={styles.fabText}>Copilot</Text>
      </TouchableOpacity>

      {/* Copilot Drawer Modal */}
      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.drawerSheet}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleGroup}>
                <View style={styles.copilotAvatar}>
                  <Text style={styles.avatarIcon}>✨</Text>
                </View>
                <div>
                  <Text style={styles.sheetTitle}>NRYN Copilot</Text>
                  <Text style={styles.sheetSubtitle}>Autonomous AI Financial Agent</Text>
                </div>
              </View>
              <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Chat Messages */}
            <ScrollView
              style={styles.chatArea}
              contentContainerStyle={styles.chatContent}
              keyboardShouldPersistTaps="handled"
            >
              {messages.map((m, idx) => (
                <View
                  key={idx}
                  style={[styles.msgWrapper, m.role === 'user' ? styles.msgWrapperUser : styles.msgWrapperBot]}
                >
                  <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
                    <Text
                      style={[styles.bubbleText, m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextBot]}
                    >
                      {m.content}
                    </Text>
                  </View>

                  {/* Suggestion Chips */}
                  {m.role === 'assistant' && m.suggestedFollowUps && m.suggestedFollowUps.length > 0 && (
                    <View style={styles.chipsRow}>
                      {m.suggestedFollowUps.map((chip, cIdx) => (
                        <TouchableOpacity
                          key={cIdx}
                          style={styles.chip}
                          onPress={() => send(chip)}
                          disabled={busy}
                        >
                          <Text style={styles.chipText}>{chip} →</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}

              {busy && (
                <View style={[styles.msgWrapper, styles.msgWrapperBot]}>
                  <View style={[styles.bubble, styles.bubbleBot, { flexDirection: 'row', gap: 6 }]}>
                    <ActivityIndicator size="small" color={theme.accent} />
                    <Text style={[styles.bubbleText, styles.bubbleTextBot]}>Copilot is calculating...</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Input Bar */}
            <View style={styles.inputBar}>
              <TextInput
                style={styles.textInput}
                placeholder="Ask e.g. Can I afford ₹2,000 dinner?"
                placeholderTextColor={theme.textDim}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={() => send()}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.sendBtn, !input.trim() && { opacity: 0.5 }]}
                onPress={() => send()}
                disabled={!input.trim() || busy}
              >
                <Text style={styles.sendIcon}>➔</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 99,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fabIcon: { fontSize: 16 },
  fabText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  drawerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    height: '75%',
    paddingBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  copilotAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: { fontSize: 18 },
  sheetTitle: { color: theme.text, fontSize: 16, fontWeight: '900' },
  sheetSubtitle: { color: theme.textDim, fontSize: 11 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: theme.text, fontSize: 13, fontWeight: '700' },

  chatArea: { flex: 1, paddingHorizontal: 16 },
  chatContent: { paddingVertical: 14, gap: 12 },
  msgWrapper: { width: '100%' },
  msgWrapperUser: { alignItems: 'flex-end' },
  msgWrapperBot: { alignItems: 'flex-start' },

  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: theme.accent,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 13, lineHeight: 19 },
  bubbleTextUser: { color: '#FFFFFF', fontWeight: '600' },
  bubbleTextBot: { color: theme.text },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { color: theme.accent, fontSize: 11, fontWeight: '700' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: theme.text,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
