import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../../theme';

interface BarBlockProps {
  block: {
    type: 'bar';
    label: string;
    items: Array<{
      label: string;
      value: number;
      formatted: string;
      color?: string;
    }>;
  };
}

export default function BarBlock({ block }: BarBlockProps) {
  const theme = useTheme();
  const maxVal = Math.max(...block.items.map((i) => i.value), 1);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.cardAlt, borderColor: theme.colors.border }]}>
      <Text style={[styles.title, { color: theme.colors.textDim }]}>{block.label}</Text>
      <View style={styles.list}>
        {block.items.map((item, idx) => {
          const pct = Math.min(100, Math.round((item.value / maxVal) * 100));
          const color = item.color || theme.colors.accent;
          return (
            <View key={idx} style={styles.itemWrap}>
              <View style={styles.row}>
                <Text style={[styles.itemLabel, { color: theme.colors.text }]}>{item.label}</Text>
                <Text style={[styles.itemFormatted, { color: theme.colors.text }]}>{item.formatted}</Text>
              </View>
              <View style={[styles.track, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}>
                <View style={[styles.bar, { width: `${pct}%`, backgroundColor: color }]} />
              </View>
            </View>
          );
        })}
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
  title: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  list: {
    gap: 8,
  },
  itemWrap: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  itemFormatted: {
    fontSize: 12,
    fontWeight: '700',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 3,
  },
});
