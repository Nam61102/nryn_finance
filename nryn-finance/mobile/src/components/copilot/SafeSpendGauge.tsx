import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, AccessibilityInfo } from 'react-native';
import { router } from 'expo-router';
import { Target, ArrowRight } from 'lucide-react-native';
import { useTheme, makeStyles, Theme } from '../../theme';
import { AnimatedNumber } from '../ui';
import { haptic } from '../../utils/haptics';

interface SafeSpendProps {
  data: {
    hasBudget?: boolean;
    dailySafeSpendINR: number;
    todaySpentINR: number;
    todayRemainingINR: number;
    totalSpentSoFarINR?: number;
    burnStatus: 'green' | 'amber' | 'red';
    daysRemaining: number;
    insightMessage: string;
  } | null;
}

export default function SafeSpendGauge({ data }: SafeSpendProps) {
  const theme = useTheme();
  const styles = useStyles();
  const progressAnim = useRef(new Animated.Value(0)).current;

  const pct = data && data.hasBudget
    ? Math.min(100, Math.round((data.todaySpentINR / Math.max(1, data.dailySafeSpendINR)) * 100))
    : 0;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        progressAnim.setValue(pct);
      } else {
        Animated.timing(progressAnim, {
          toValue: pct,
          duration: 650,
          useNativeDriver: false,
        }).start();
      }
    }).catch(() => {
      progressAnim.setValue(pct);
    });
  }, [pct, progressAnim]);

  if (!data) return null;

  if (!data.hasBudget) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <Target size={18} color={theme.accent} />
            <Text style={styles.title}>Safe-to-Spend Daily Allowance</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: theme.cardAlt, borderColor: theme.border }]}>
            <Text style={[styles.statusText, { color: theme.textDim }]}>NO BUDGET SET</Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <View>
            <Text style={styles.metricSub}>Spent Today</Text>
            <AnimatedNumber
              value={data.todaySpentINR}
              style={[styles.metricMedium, { color: theme.accent }]}
            />
          </View>
          <View style={styles.divider} />
          <View>
            <Text style={styles.metricSub}>Spent This Month</Text>
            <AnimatedNumber
              value={data.totalSpentSoFarINR || 0}
              style={[styles.metricMedium, { color: theme.text }]}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.promptBtn}
          onPress={() => {
            haptic.light();
            router.push('/(tabs)/budgets');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.promptBtnText}>
            Set monthly budget to unlock daily safe limit
          </Text>
          <ArrowRight size={14} color={theme.accent} />
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor =
    data.burnStatus === 'green' ? theme.success : data.burnStatus === 'amber' ? theme.warn : theme.danger;
  const statusBg =
    data.burnStatus === 'green' ? theme.successLight : data.burnStatus === 'amber' ? theme.warnLight : theme.dangerLight;
  const statusBorder =
    data.burnStatus === 'green' ? theme.successBorder : data.burnStatus === 'amber' ? theme.warnBorder : theme.dangerBorder;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Target size={18} color={theme.accent} />
          <Text style={styles.title}>Safe-to-Spend Daily Allowance</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusBorder }]}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {data.burnStatus.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.metricRow}>
        <View>
          <Text style={styles.metricSub}>Today's Safe Limit</Text>
          <AnimatedNumber
            value={data.dailySafeSpendINR}
            style={styles.metricLarge}
          />
        </View>
        <View style={styles.divider} />
        <View>
          <Text style={styles.metricSub}>Spent Today</Text>
          <AnimatedNumber
            value={data.todaySpentINR}
            style={[styles.metricMedium, { color: statusColor }]}
          />
        </View>
        <View style={styles.divider} />
        <View>
          <Text style={styles.metricSub}>Remaining</Text>
          <AnimatedNumber
            value={data.todayRemainingINR}
            style={[styles.metricMedium, { color: theme.text }]}
          />
        </View>
      </View>

      {/* Animated Progress Bar Track */}
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { width: progressWidth, backgroundColor: statusColor },
          ]}
        />
      </View>

      <Text style={styles.hintText}>{data.insightMessage}</Text>
    </View>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.card,
      borderRadius: t.radius.lg,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
      ...t.shadows.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { color: t.text, fontSize: 14, fontWeight: '800' },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 10, fontWeight: '800' },
    metricRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    metricSub: { color: t.textDim, fontSize: 11, fontWeight: '600' },
    metricLarge: { color: t.text, fontSize: 20, fontWeight: '900', marginTop: 2 },
    metricMedium: { fontSize: 16, fontWeight: '800', marginTop: 2 },
    divider: { width: 1, height: 32, backgroundColor: t.border },
    track: {
      height: 6,
      backgroundColor: t.cardAlt,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 8,
    },
    fill: { height: '100%', borderRadius: 3 },
    hintText: { color: t.textDim, fontSize: 11, lineHeight: 16 },
    promptBtn: {
      marginTop: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: t.accentLight,
      borderRadius: t.radius.sm,
      borderWidth: 1,
      borderColor: t.accentBorder,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    promptBtnText: {
      color: t.accent,
      fontSize: 12,
      fontWeight: '700',
    },
  })
);
