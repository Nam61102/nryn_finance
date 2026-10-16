import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Sparkles, Target, ShieldCheck, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, makeStyles, Theme } from '../../theme';
import AnimatedNumber from '../ui/AnimatedNumber';
import { haptic } from '../../utils/haptics';
import { formatNumberINR } from '../../utils/format';

interface HomeHeroCardProps {
  safeSpend: {
    hasBudget?: boolean;
    dailySafeSpendINR: number;
    todaySpentINR: number;
    todayRemainingINR: number;
    totalBudgetINR?: number;
    totalSpentSoFarINR?: number;
    burnStatus: 'green' | 'amber' | 'red';
    daysRemaining: number;
    insightMessage: string;
  } | null;
  onPressBudget?: () => void;
}

export default function HomeHeroCard({ safeSpend }: HomeHeroCardProps) {
  const theme = useTheme();
  const styles = useStyles();

  const handleSetBudget = () => {
    haptic.medium();
    router.push('/(tabs)/budgets');
  };

  const hasBudget = Boolean(safeSpend?.hasBudget);

  if (!hasBudget) {
    const todaySpent = Number(safeSpend?.todaySpentINR) || 0;

    return (
      <View style={styles.wrap}>
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#1E293B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.topRow}>
            <View style={styles.radarBadge}>
              <Sparkles size={13} color="#FF9E40" />
              <Text style={styles.radarBadgeText}>FINANCIAL RADAR</Text>
            </View>
            <Text style={styles.noBudgetText}>No Budget Set</Text>
          </View>

          <Text style={styles.subLabel}>SPENT TODAY</Text>
          <AnimatedNumber value={todaySpent} style={styles.heroAmount} />

          <View style={styles.insightBox}>
            <Text style={styles.insightText}>
              Set a monthly target to calculate your dynamic daily allowance and prevent overspending.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={handleSetBudget}
            activeOpacity={0.85}
          >
            <Target size={16} color="#0B0F17" />
            <Text style={styles.ctaBtnText}>Set a monthly budget to unlock daily limits</Text>
            <ArrowRight size={14} color="#0B0F17" />
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  const dailySafeLimit = Number(safeSpend?.dailySafeSpendINR) || 0;
  const todayRemaining = Number(safeSpend?.todayRemainingINR) || 0;
  const todaySpent = Number(safeSpend?.todaySpentINR) || 0;
  const daysLeft = Number(safeSpend?.daysRemaining) || 1;
  const monthTotal = Number(safeSpend?.totalBudgetINR) || 0;
  const monthSpent = Number(safeSpend?.totalSpentSoFarINR) || 0;
  const monthLeft = Math.max(0, monthTotal - monthSpent);

  const spentRatio = dailySafeLimit > 0 ? todaySpent / dailySafeLimit : 0;
  const progressPct = Number.isFinite(spentRatio) ? Math.max(0, Math.min(100, Math.round(spentRatio * 100))) : 0;
  const isSafeZone = todaySpent <= dailySafeLimit;

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['#0B132B', '#111D38', '#172544']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Top Meta Header */}
        <View style={styles.topRow}>
          <View style={styles.safeBadge}>
            <View style={[styles.statusDot, { backgroundColor: isSafeZone ? '#10B981' : '#EF4444' }]} />
            <Text style={styles.safeBadgeText}>
              {isSafeZone ? 'SAFE TO SPEND TODAY' : 'DAILY LIMIT EXCEEDED'}
            </Text>
          </View>
          <View style={styles.daysBadge}>
            <Text style={styles.daysBadgeText}>
              {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
            </Text>
          </View>
        </View>

        {/* Hero Value Display */}
        <View style={styles.amountWrap}>
          <Text style={styles.amountLabel}>DAILY SAFE ALLOWANCE</Text>
          <AnimatedNumber value={todayRemaining} style={styles.heroAmount} />
        </View>

        {/* Sleek Dual-Tone Progress Meter */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={isSafeZone ? ['#10B981', '#34D399'] : ['#EF4444', '#F87171']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progressPct}%` }]}
            />
          </View>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>
              Spent: ₹{formatNumberINR(todaySpent)}
            </Text>
            <Text style={styles.progressLabel}>
              Daily Target: ₹{formatNumberINR(dailySafeLimit)}
            </Text>
          </View>
        </View>

        {/* AI Insight Chip */}
        <View style={styles.insightBox}>
          <ShieldCheck size={16} color="#34D399" style={{ marginTop: 1 }} />
          <Text style={styles.insightText} numberOfLines={2}>
            {safeSpend?.insightMessage || 'You are in the safe zone! Full daily limit is available.'}
          </Text>
        </View>

        {/* Metric Summary Grid Footer */}
        <View style={styles.footerGrid}>
          <View style={styles.footerCol}>
            <Text style={styles.footerLabel}>REMAINING THIS MONTH</Text>
            <Text style={styles.footerValue}>₹{formatNumberINR(monthLeft)}</Text>
          </View>

          <View style={styles.footerDivider} />

          <View style={styles.footerCol}>
            <Text style={styles.footerLabel}>MONTHLY BUDGET</Text>
            <Text style={styles.footerValue}>₹{formatNumberINR(monthTotal)}</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    card: {
      padding: 22,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 6,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    safeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    safeBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    daysBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    daysBadgeText: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: 11,
      fontWeight: '700',
    },
    radarBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255, 109, 0, 0.15)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255, 109, 0, 0.3)',
    },
    radarBadgeText: {
      color: '#FF9E40',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    noBudgetText: {
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: 11,
      fontWeight: '700',
    },
    amountWrap: {
      marginVertical: 4,
    },
    amountLabel: {
      color: 'rgba(255, 255, 255, 0.55)',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.9,
      marginBottom: 2,
    },
    subLabel: {
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    heroAmount: {
      color: '#FFFFFF',
      fontSize: 46,
      fontWeight: '900',
      letterSpacing: -1.2,
      lineHeight: 52,
    },
    progressContainer: {
      marginTop: 12,
      marginBottom: 12,
    },
    progressTrack: {
      height: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    progressLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    progressLabel: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: 11,
      fontWeight: '600',
    },
    insightBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: 4,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    insightText: {
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '500',
      flex: 1,
    },
    footerGrid: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    footerCol: {
      flex: 1,
    },
    footerDivider: {
      width: 1,
      height: 28,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      marginHorizontal: 14,
    },
    footerLabel: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.6,
      marginBottom: 3,
    },
    footerValue: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    ctaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#00E676',
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 16,
      marginTop: 16,
    },
    ctaBtnText: {
      color: '#0B0F17',
      fontSize: 13,
      fontWeight: '800',
    },
  })
);
