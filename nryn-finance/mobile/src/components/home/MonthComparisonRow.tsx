import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { TrendingDown, TrendingUp, Minus, Target, ChevronRight, PieChart } from 'lucide-react-native';
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
      {/* Month Carousel */}
      <MonthSwitcher months={months} value={month} onChange={onSelectMonth} />

      {/* Modern Velocity Card */}
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <PieChart size={14} color="#FF6D00" />
            <Text style={styles.cardHeaderTitle}>MONTHLY COMPARISON</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              haptic.light();
              router.push('/(tabs)/categories');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.cardHeaderRight}
          >
            <Text style={styles.viewAnalyticsText}>Categories</Text>
            <ChevronRight size={12} color="#FF6D00" />
          </TouchableOpacity>
        </View>

        {/* Side-by-Side Stat Pods */}
        <View style={styles.statGrid}>
          {/* Current Month Pod */}
          <View style={styles.statPodPrimary}>
            <View style={styles.podLabelRow}>
              <View style={styles.activeDot} />
              <Text style={styles.statLabel} numberOfLines={1}>
                {status?.period?.shortLabel ? `This Month (${status.period.shortLabel})` : 'This Month'}
              </Text>
            </View>
            <Text style={styles.statValueThis}>₹{currentSpent}</Text>
          </View>

          {/* Last Month Pod */}
          <View style={styles.statPodSecondary}>
            <View style={styles.podLabelRow}>
              <Text style={styles.statLabelSecondary} numberOfLines={1}>
                {comparison?.prevLabel ? `Last (${comparison.prevLabel})` : 'Last Month'}
              </Text>
            </View>
            <Text style={styles.statValuePrev}>₹{prevSpent}</Text>
          </View>
        </View>

        {/* Comparison Insight Pill */}
        {comparison && (
          <View style={styles.comparisonBadge}>
            <View style={styles.badgeIconWrap}>
              {isSaved ? (
                <TrendingDown size={14} color="#FF6D00" />
              ) : isMore ? (
                <TrendingUp size={14} color="#FF6D00" />
              ) : (
                <Minus size={14} color="#FF6D00" />
              )}
            </View>
            <Text style={styles.comparisonText} numberOfLines={1}>
              {comparison.comparisonText || 'Tracking active'}
            </Text>
          </View>
        )}

        {/* Budget Progress Bar */}
        {noBudget ? (
          <TouchableOpacity
            style={styles.budgetPromptBtn}
            onPress={() => {
              haptic.light();
              router.push('/(tabs)/budgets');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.budgetPromptIconWrap}>
              <Target size={14} color="#FF6D00" />
            </View>
            <Text style={styles.budgetPromptText}>Set monthly budget to track safe pace</Text>
            <ChevronRight size={14} color="#FF6D00" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.budgetProgressWrap}
            onPress={() => {
              haptic.light();
              router.push('/(tabs)/budgets');
            }}
            activeOpacity={0.85}
          >
            <View style={styles.budgetHeader}>
              <View style={styles.budgetHeaderLeft}>
                <Text style={styles.budgetLabel}>Monthly Budget</Text>
                <Text style={styles.budgetValue}>₹{formatNumberINR((ring?.total || 0) / 100)}</Text>
              </View>
              <View style={styles.budgetHeaderRight}>
                <Text style={styles.budgetStatus}>
                  {ring?.over
                    ? `Over by ₹${formatNumberINR(((ring?.spent || 0) - (ring?.total || 0)) / 100)}`
                    : `₹${formatNumberINR((ring?.remaining || 0) / 100)} left`}
                </Text>
                <View style={styles.ratioPill}>
                  <Text style={styles.ratioPillText}>{safeRatioPct}% used</Text>
                </View>
              </View>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${safeRatioPct}%` }]} />
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
      backgroundColor: '#FFFFFF',
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: '#F1F5F9',
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    cardHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    cardHeaderTitle: {
      fontSize: 10.5,
      fontWeight: '800',
      color: '#E65100',
      letterSpacing: 0.8,
    },
    cardHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    viewAnalyticsText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#FF6D00',
    },
    statGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    statPodPrimary: {
      flex: 1.1,
      backgroundColor: '#FFF7ED',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#FFD7B2',
    },
    statPodSecondary: {
      flex: 0.9,
      backgroundColor: '#FFF7ED',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#FFD7B2',
    },
    podLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#FF6D00',
    },
    statLabel: {
      color: '#7C2D12',
      fontSize: 11,
      fontWeight: '700',
    },
    statLabelSecondary: {
      color: '#7C2D12',
      fontSize: 11,
      fontWeight: '600',
    },
    statValueThis: {
      color: '#0F172A',
      fontSize: 20,
      fontWeight: '900',
      marginTop: 4,
      letterSpacing: -0.5,
    },
    statValuePrev: {
      color: '#64748B',
      fontSize: 17,
      fontWeight: '700',
      marginTop: 4,
    },
    comparisonBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#FFF7ED',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginTop: 12,
      borderWidth: 1,
      borderColor: '#FFD7B2',
    },
    badgeIconWrap: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    comparisonText: {
      color: '#431407',
      fontSize: 12,
      fontWeight: '800',
      flex: 1,
    },
    budgetPromptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: '#FFF7ED',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#FFD7B2',
    },
    budgetPromptIconWrap: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    budgetPromptText: {
      color: '#E65100',
      fontSize: 12,
      fontWeight: '800',
      flex: 1,
    },
    budgetProgressWrap: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#FFE4CC',
    },
    budgetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 8,
    },
    budgetHeaderLeft: {
      gap: 2,
    },
    budgetLabel: {
      color: '#7C2D12',
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    budgetValue: {
      color: '#0F172A',
      fontSize: 14,
      fontWeight: '900',
    },
    budgetHeaderRight: {
      alignItems: 'flex-end',
      gap: 3,
    },
    budgetStatus: {
      color: '#FF6D00',
      fontSize: 13,
      fontWeight: '900',
    },
    ratioPill: {
      backgroundColor: '#FFF7ED',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#FFD7B2',
    },
    ratioPillText: {
      color: '#FF6D00',
      fontSize: 10,
      fontWeight: '800',
    },
    progressBarTrack: {
      height: 7,
      backgroundColor: '#FFF7ED',
      borderRadius: 4,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#FFE4CC',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: '#FF6D00',
      borderRadius: 4,
    },
  })
);
