import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme, makeStyles, Theme } from '../theme';
import { formatINR } from '../utils/format';
import PressableScale from './ui/PressableScale';

type Chip = {
  category: string;
  label: string;
  icon?: string;
  color?: string;
  budget: number;
  spent: number;
  remaining: number;
  ratio: number;
  over: boolean;
};

export default function CategoryChip({ chip, onPress }: { chip: Chip; onPress?: () => void }) {
  const theme = useTheme();
  const styles = useStyles();

  const size = 52;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progressColor = chip?.over ? theme.danger : chip?.color || theme.accent;

  const rawRatio = Number(chip?.ratio);
  const safeRatio = Number.isFinite(rawRatio) ? Math.max(0, Math.min(1, rawRatio)) : 0;
  const safeOffset = c * (1 - safeRatio);

  return (
    <PressableScale
      onPress={onPress}
      hapticType="light"
      style={styles.wrap}
    >
      <Text style={styles.label} numberOfLines={1}>{chip?.label || 'Category'}</Text>
      <View style={{ width: size, height: size, marginVertical: 6 }}>
        <Svg width={size} height={size}>
          <G rotation={-90} originX={size / 2} originY={size / 2}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={theme.cardAlt}
              strokeWidth={stroke}
              fill="none"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={progressColor}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={safeOffset}
            />
          </G>
        </Svg>
        <View style={styles.iconWrap}>
          <Text style={{ fontSize: 18 }}>{chip?.icon || '📦'}</Text>
        </View>
      </View>
      <Text style={[styles.amount, chip?.over && { color: theme.danger }]}>
        {formatINR(Math.abs(chip?.remaining || 0))}
      </Text>
      <Text style={styles.sub}>{chip?.over ? 'Over' : 'Remaining'}</Text>
    </PressableScale>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    wrap: {
      width: 96,
      alignItems: 'center',
      backgroundColor: t.card,
      borderRadius: t.radius.md,
      paddingVertical: 12,
      paddingHorizontal: 8,
      marginRight: 10,
      borderWidth: 1,
      borderColor: t.border,
      ...t.shadows.sm,
    },
    iconWrap: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      color: t.text,
      fontSize: 12,
      fontWeight: '700',
    },
    amount: {
      color: t.text,
      fontSize: 13,
      fontWeight: '800',
    },
    sub: {
      color: t.textDim,
      fontSize: 10,
      marginTop: 1,
    },
  })
);
