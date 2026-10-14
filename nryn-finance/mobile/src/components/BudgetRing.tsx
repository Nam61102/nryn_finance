import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, StyleSheet, Easing, AccessibilityInfo } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme, makeStyles, Theme } from '../theme';
import { formatINR } from '../utils/format';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  total: number;
  spent: number;
  remaining: number;
  ratio: number;
  over: boolean;
  size?: number;
};

export default function BudgetRing({
  total,
  spent,
  remaining,
  ratio,
  over,
  size = 200,
}: Props) {
  const theme = useTheme();
  const styles = useStyles();

  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        anim.setValue(Math.min(1, Math.max(0, ratio)));
      } else {
        Animated.timing(anim, {
          toValue: Math.min(1, Math.max(0, ratio)),
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }
    }).catch(() => {
      anim.setValue(Math.min(1, Math.max(0, ratio)));
    });
  }, [ratio, anim]);

  const dashOffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  // Dynamic status color: Green -> Amber -> Red
  const ringColor = over
    ? theme.danger
    : ratio > 0.85
    ? theme.danger
    : ratio > 0.65
    ? theme.warn
    : theme.success;

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size }}>
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
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={ringColor}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </G>
        </Svg>
        <View style={styles.center}>
          <Text style={[styles.big, over && { color: theme.danger }]}>
            {formatINR(Math.abs(remaining))}
          </Text>
          <Text style={styles.label}>{over ? 'Over budget' : 'Remaining'}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.stat}>{formatINR(total)}</Text>
          <Text style={styles.label}>Total Budget</Text>
        </View>
        <View style={styles.col}>
          <Text style={[styles.stat, { color: ringColor }]}>{formatINR(spent)}</Text>
          <Text style={styles.label}>Spent</Text>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
    },
    center: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    big: {
      color: t.text,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    label: {
      color: t.textDim,
      fontSize: 12,
      marginTop: 2,
      fontWeight: '600',
    },
    stat: {
      color: t.text,
      fontSize: 16,
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      paddingHorizontal: 16,
      marginTop: 16,
    },
    col: {
      alignItems: 'center',
      flex: 1,
    },
  })
);
