import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { useTheme } from '../../../../theme';

interface StatBlockProps {
  block: {
    type: 'stat';
    label: string;
    value: string;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
  };
}

export default function StatBlock({ block }: StatBlockProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.cardAlt, borderColor: theme.colors.border }]}>
      <Text style={[styles.label, { color: theme.colors.textDim }]}>{block.label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: theme.colors.text }]}>{block.value}</Text>
        {block.trend === 'up' && <TrendingUp size={18} color="#10B981" />}
        {block.trend === 'down' && <TrendingDown size={18} color="#FF4757" />}
        {block.trend === 'neutral' && <Minus size={18} color={theme.colors.textDim} />}
      </View>
      {Boolean(block.subtitle) && (
        <Text style={[styles.subtitle, { color: theme.colors.textDim }]}>{block.subtitle}</Text>
      )}
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
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
});
