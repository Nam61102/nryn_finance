import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '../../../theme';
import PressableScale from '../../ui/PressableScale';

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export default function SuggestionChips({
  suggestions,
  onSelect,
  disabled,
}: SuggestionChipsProps) {
  const theme = useTheme();

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {suggestions.map((item, idx) => (
        <PressableScale
          key={idx}
          onPress={() => onSelect(item)}
          disabled={disabled}
          style={[
            styles.chip,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.isDark ? '#23304A' : '#E2E8F0',
            },
            disabled && { opacity: 0.5 },
          ]}
        >
          <Sparkles size={12} color={theme.colors.accent} />
          <Text style={[styles.text, { color: theme.colors.text }]}>{item}</Text>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
