import React, { useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Send, Square } from 'lucide-react-native';
import { useTheme } from '../../../theme';
import PressableScale from '../../ui/PressableScale';
import VoiceRecorder from './VoiceRecorder';

interface ChatInputProps {
  onSend: (text: string, options?: { fromVoice?: boolean }) => void;
  onStop?: () => void;
  busy?: boolean;
}

export default function ChatInput({ onSend, onStop, busy }: ChatInputProps) {
  const theme = useTheme();
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim() || busy) return;
    const toSend = text.trim();
    setText('');
    onSend(toSend, { fromVoice: false });
  };

  const handleVoiceTranscription = (spokenText: string) => {
    if (!spokenText.trim() || busy) return;
    onSend(spokenText.trim(), { fromVoice: true });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <TextInput
        style={[styles.input, { color: theme.colors.text }]}
        placeholder="Type or tap mic (मराठी / हिंदी / Eng)"
        placeholderTextColor={theme.colors.textDim}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={500}
        onSubmitEditing={handleSend}
      />

      {/* Voice Input Button */}
      <VoiceRecorder
        onTranscriptionComplete={handleVoiceTranscription}
        disabled={busy}
      />

      {/* Send or Stop Button */}
      {busy ? (
        <PressableScale onPress={onStop} style={[styles.btn, { backgroundColor: theme.colors.danger }]}>
          <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
        </PressableScale>
      ) : (
        <PressableScale
          onPress={handleSend}
          disabled={!text.trim()}
          style={[
            styles.btn,
            { backgroundColor: text.trim() ? theme.colors.accent : theme.colors.cardAlt },
            !text.trim() && { opacity: 0.5 },
          ]}
        >
          <Send size={16} color={text.trim() ? '#0B0F0D' : theme.colors.textDim} />
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    maxHeight: 80,
    paddingVertical: 4,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
