import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, StyleSheet, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../theme';
import { formatINR } from '../services/api';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = { total: number; spent: number; remaining: number; ratio: number; over: boolean; size?: number };

/**
 * The ring ARC floors at 0..1, but the REMAINING NUMBER shows the true value,
 * negative included — so an overspend is visible rather than hidden (§7).
 * Animates from the previous value, not from zero, so a month switch doesn't
 * read as a reload (§8.1).
 */
export default function BudgetRing({ total, spent, remaining, ratio, over, size = 190 }: Props) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: ratio, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [ratio]);

  const dashOffset = anim.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });
  const color = over ? theme.danger : theme.accent;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.border} strokeWidth={stroke} fill="none" />
          <AnimatedCircle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={dashOffset}
          />
        </Svg>
        <View style={styles.center}>
          <Text style={[styles.big, over && { color: theme.danger }]}>{formatINR(Math.abs(remaining))}</Text>
          <Text style={styles.label}>{over ? 'Over budget' : 'Remaining'}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.stat}>{formatINR(total)}</Text>
          <Text style={styles.label}>Total Budget</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.stat}>{formatINR(spent)}</Text>
          <Text style={styles.label}>Spent</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  big: { color: theme.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  label: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  stat: { color: theme.text, fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 12, marginTop: 14 },
  col: { alignItems: 'center', flex: 1 },
});
