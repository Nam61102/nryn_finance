import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { TrendingDown, TrendingUp, Minus, Target } from 'lucide-react-native';
import { useTheme, makeStyles, Theme } from '../../theme';
import MonthSwitcher from '../MonthSwitcher';
import { haptic } from '../../utils/haptics';
import { formatNumberINR } from '../../utils/format';

interface MonthComparisonRowProps {
  months: any[];
  month: string;
  onSelectMonth: (m: string) => void;
  status: any;
}

export default function MonthComparisonRow({
  months,
  month,
  onSelectMonth,
  status,
}: MonthComparisonRowProps) {
  const theme = useTheme();
  const styles = useStyles();

  const comparison = status?.comparison;
  const ring = status?.ring;
  const noBudget = !ring?.total || ring.total <= 0;

  const currentSpent = formatNumberINR((ring?.spent || 0) / 100);
  const prevSpent = formatNumberINR((comparison?.lastMonthSpent || 0) / 100);

  const isSaved = comparison?.isSaved;
  const isMore = comparison?.isMore;

  const rawRatio = Number(ring?.ratio);
  const safeRatioPct = Number.isFinite(rawRatio) ? Math.max(0, Math.min(100, Math.round(rawRatio * 100))) : 0;

  return (
    <View style={styles.container}>
      <MonthSwitcher months={months} value={month} onChange={onSelectMonth} />

      <View style={styles.card}>
        <View style={styles.statGrid}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>
              This Month ({status?.period?.shortLabel || 'Current'})
            </Text>
            <Text style={styles.statValueThis}>₹{currentSpent}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statCol}>
            <Text style={styles.statLabel}>
              Last Month ({comparison?.prevLabel || 'Previous'})
            </Text>
            <Text style={styles.statValuePrev}>₹{prevSpent}</Text>
          </View>
        </View>

        {comparison && (
          <View
            style={[
              styles.comparisonBadge,
              isSaved && styles.badgeSaved,
              isMore && styles.badgeMore,
            ]}
          >
            {isSaved ? (
              <TrendingDown size={14} color={theme.success} />
            ) : isMore ? (
              <TrendingUp size={14} color={theme.danger} />
            ) : (
              <Minus size={14} color={theme.textDim} />
            )}
            <Text
              style={[
                styles.comparisonText,
                isSaved && { color: theme.success },
                isMore && { color: theme.danger },
              ]}
            >
              {comparison.comparisonText || 'Tracking active'}
            </Text>
          </View>
        )}

        {noBudget ? (
          <TouchableOpacity
            style={styles.budgetPromptBtn}
            onPress={() => {
              haptic.light();
              router.push('/(tabs)/budgets');
            }}
            activeOpacity={0.8}
          >
            <Target size={14} color={theme.accent} />
            <Text style={styles.budgetPromptText}>Set monthly budget to track pace →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.budgetProgressWrap}
            onPress={() => {
              haptic.light();
              router.push('/(tabs)/budgets');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.budgetHeader}>
              <Text style={styles.budgetLabel}>
                Monthly Budget: ₹{formatNumberINR((ring?.total || 0) / 100)}
              </Text>
              <Text style={[styles.budgetStatus, ring?.over && { color: theme.danger }]}>
                {ring?.over
                  ? `Over by ₹${formatNumberINR((((ring?.spent || 0) - (ring?.total || 0))) / 100)}`
                  : `₹${formatNumberINR((ring?.remaining || 0) / 100)} left`}
              </Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${safeRatioPct}%` },
                  ring?.over && { backgroundColor: theme.danger },
                ]}
              />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    card: {
      backgroundColor: t.card,
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: t.radius.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
      ...t.shadows.sm,
    },
    statGrid: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statCol: {
      flex: 1,
    },
    divider: {
      width: 1,
      height: 36,
      backgroundColor: t.border,
      marginHorizontal: 16,
    },
    statLabel: {
      color: t.textDim,
      fontSize: 11,
      fontWeight: '600',
    },
    statValueThis: {
      color: t.text,
      fontSize: 20,
      fontWeight: '900',
      marginTop: 2,
    },
    statValuePrev: {
      color: t.textDim,
      fontSize: 18,
      fontWeight: '700',
      marginTop: 2,
    },
    comparisonBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: t.cardAlt,
      borderRadius: t.radius.sm,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginTop: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    badgeSaved: {
      backgroundColor: t.successLight,
      borderColor: t.successBorder,
    },
    badgeMore: {
      backgroundColor: t.dangerLight,
      borderColor: t.dangerBorder,
    },
    comparisonText: {
      color: t.text,
      fontSize: 12,
      fontWeight: '700',
    },
    budgetPromptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      paddingVertical: 8,
    },
    budgetPromptText: {
      color: t.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    budgetProgressWrap: {
      marginTop: 12,
    },
    budgetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    budgetLabel: {
      color: t.textDim,
      fontSize: 11,
      fontWeight: '600',
    },
    budgetStatus: {
      color: t.accent,
      fontSize: 11,
      fontWeight: '800',
    },
    progressBarTrack: {
      height: 6,
      backgroundColor: t.cardAlt,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: t.accent,
      borderRadius: 3,
    },
  })
);
