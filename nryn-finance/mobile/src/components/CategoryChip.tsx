import React from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../theme';
import { formatINR } from '../services/api';

type Chip = { category: string; label: string; icon?: string; color?: string; budget: number; spent: number; remaining: number; ratio: number; over: boolean };

export default function CategoryChip({ chip, onPress }: { chip: Chip; onPress?: () => void }) {
  const size = 52;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = chip.over ? theme.danger : chip.color || theme.accent;

  return (
    <TouchableOpacity style={styles.wrap} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.label} numberOfLines={1}>{chip.label}</Text>
      <View style={{ width: size, height: size, marginVertical: 6 }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.border} strokeWidth={stroke} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - chip.ratio)} />
        </Svg>
        <View style={styles.iconWrap}>
          {/* Never render a blank circle — an empty slot in a dense list reads as a bug. */}
          <Text style={{ fontSize: 18 }}>{chip.icon || '📦'}</Text>
        </View>
      </View>
      <Text style={[styles.amount, chip.over && { color: theme.danger }]}>{formatINR(Math.abs(chip.remaining))}</Text>
      <Text style={styles.sub}>{chip.over ? 'Over' : 'Remaining'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 96,
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  iconWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  label: { color: theme.text, fontSize: 12, fontWeight: '700' },
  amount: { color: theme.text, fontSize: 13, fontWeight: '800' },
  sub: { color: theme.textDim, fontSize: 10, marginTop: 1 },
});
