import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Sparkles, Target } from 'lucide-react-native';
import { useTheme, makeStyles, Theme } from '../../theme';
import { GradientCard, AnimatedNumber } from '../ui';
import { haptic } from '../../utils/haptics';

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
    const todaySpent = safeSpend?.todaySpentINR || 0;

    return (
      <View style={styles.wrap}>
        <GradientCard style={styles.card}>
          <View style={styles.topRow}>
            <View style={styles.badge}>
              <Sparkles size={12} color="#FFFFFF" />
              <Text style={styles.badgeText}>FINANCIAL RADAR</Text>
            </View>
            <Text style={styles.dateHint}>No Budget Set</Text>
          </View>

          <Text style={styles.label}>Spent today</Text>
          <AnimatedNumber
            value={todaySpent}
            style={styles.heroAmount}
          />

          <Text style={styles.insightText}>
            You haven't set a monthly budget yet. Set one to unlock your dynamic safe-to-spend daily limit!
          </Text>

          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={handleSetBudget}
            activeOpacity={0.85}
          >
            <Target size={16} color={theme.isDark ? '#FFFFFF' : theme.accent} />
            <Text style={styles.ctaBtnText}>Set a budget to unlock your daily limit</Text>
            <ArrowRight size={14} color={theme.isDark ? '#FFFFFF' : theme.accent} />
          </TouchableOpacity>
        </GradientCard>
      </View>
    );
  }

  const dailySafeLimit = safeSpend?.dailySafeSpendINR || 0;
  const todayRemaining = safeSpend?.todayRemainingINR || 0;
  const todaySpent = safeSpend?.todaySpentINR || 0;
  const daysLeft = safeSpend?.daysRemaining || 1;
  const monthTotal = safeSpend?.totalBudgetINR || 0;
  const monthSpent = safeSpend?.totalSpentSoFarINR || 0;
  const monthLeft = Math.max(0, monthTotal - monthSpent);

  const spentRatio = Math.min(1, todaySpent / Math.max(1, dailySafeLimit));
  const progressPct = Math.round(spentRatio * 100);

  return (
    <View style={styles.wrap}>
      <GradientCard style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <Sparkles size={12} color="#FFFFFF" />
            <Text style={styles.badgeText}>SAFE TO SPEND</Text>
          </View>
          <Text style={styles.dateHint}>
            {daysLeft} {daysLeft === 1 ? 'day' : 'days'} to go
          </Text>
        </View>

        <Text style={styles.label}>Safe to spend today</Text>
        <AnimatedNumber
          value={todayRemaining}
          style={styles.heroAmount}
        />

        {/* Progress Bar of Today's Spend vs Safe Daily Allowance */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>
              Spent today: ₹{todaySpent.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.progressLabel}>
              Daily target: ₹{dailySafeLimit.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {safeSpend?.insightMessage && (
          <Text style={styles.insightText} numberOfLines={2}>
            {safeSpend.insightMessage}
          </Text>
        )}

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>
            ₹{monthLeft.toLocaleString('en-IN')} left this month · {daysLeft} days to go
          </Text>
        </View>
      </GradientCard>
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
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    dateHint: {
      color: 'rgba(255, 255, 255, 0.85)',
      fontSize: 12,
      fontWeight: '700',
    },
    label: {
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },
    heroAmount: {
      color: '#FFFFFF',
      fontSize: 42,
      fontWeight: '900',
      letterSpacing: -1,
      marginVertical: 4,
    },
    progressContainer: {
      marginTop: 8,
      marginBottom: 10,
    },
    progressTrack: {
      height: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#FFFFFF',
      borderRadius: 3,
    },
    progressLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    progressLabel: {
      color: 'rgba(255, 255, 255, 0.85)',
      fontSize: 11,
      fontWeight: '600',
    },
    insightText: {
      color: 'rgba(255, 255, 255, 0.95)',
      fontSize: 13,
      lineHeight: 18,
      marginTop: 6,
      fontWeight: '500',
    },
    footerRow: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.2)',
    },
    footerText: {
      color: 'rgba(255, 255, 255, 0.85)',
      fontSize: 12,
      fontWeight: '700',
    },
    ctaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#FFFFFF',
      borderRadius: t.radius.md,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginTop: 16,
    },
    ctaBtnText: {
      color: t.accent,
      fontSize: 13,
      fontWeight: '800',
    },
  })
);
