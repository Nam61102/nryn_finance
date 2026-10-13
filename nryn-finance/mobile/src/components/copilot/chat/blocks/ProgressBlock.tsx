import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../../theme';

interface ProgressBlockProps {
  block: {
    type: 'progress';
    label: string;
    current: number;
    max: number;
    currentFormatted: string;
    maxFormatted: string;
    percent: number;
    color?: string;
  };
}

export default function ProgressBlock({ block }: ProgressBlockProps) {
  const theme = useTheme();
  const barColor = block.color || theme.colors.accent;
  const clampedPercent = Math.min(100, Math.max(0, block.percent));

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.cardAlt, borderColor: theme.colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: theme.colors.textDim }]}>{block.label}</Text>
        <Text style={[styles.percent, { color: barColor }]}>{block.percent}%</Text>
      </View>

      <View style={[styles.track, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}>
        <View style={[styles.bar, { width: `${clampedPercent}%`, backgroundColor: barColor }]} />
      </View>

      <View style={styles.footerRow}>
        <Text style={[styles.subText, { color: theme.colors.text }]}>{block.currentFormatted}</Text>
        <Text style={[styles.subTextDim, { color: theme.colors.textDim }]}>of {block.maxFormatted}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  percent: {
    fontSize: 12,
    fontWeight: '700',
  },
  track: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subText: {
    fontSize: 12,
    fontWeight: '700',
  },
  subTextDim: {
    fontSize: 11,
  },
});
