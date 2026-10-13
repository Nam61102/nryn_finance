import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { useTheme, makeStyles, Theme } from '../../theme';
import { haptic } from '../../utils/haptics';

interface HomeHeaderProps {
  userName?: string;
  needsReviewCount?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export default function HomeHeader({
  userName = 'Friend',
  needsReviewCount = 0,
  refreshing = false,
  onRefresh,
}: HomeHeaderProps) {
  const theme = useTheme();
  const styles = useStyles();

  // Compute IST greeting
  const getISTGreeting = () => {
    // Current IST hours
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const istMinutes = utcHours * 60 + utcMinutes + 330; // +5:30
    const istHours = Math.floor((istMinutes % 1440) / 60);

    if (istHours >= 4 && istHours < 12) return 'Good morning';
    if (istHours >= 12 && istHours < 17) return 'Good afternoon';
    if (istHours >= 17 && istHours < 22) return 'Good evening';
    return 'Good night';
  };

  const greeting = getISTGreeting();
  const initial = (userName.trim()[0] || 'N').toUpperCase();

  const handleReviewPress = () => {
    haptic.light();
    router.push('/transactions?needsReview=true');
  };

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.name}>{userName}</Text>
        </View>
      </View>

      <View style={styles.right}>
        {refreshing ? (
          <View style={styles.refreshPill}>
            <ActivityIndicator size="small" color={theme.accent} />
            <Text style={styles.refreshPillText}>Updating…</Text>
          </View>
        ) : onRefresh ? (
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => {
              haptic.light();
              onRefresh();
            }}
            activeOpacity={0.7}
            accessibilityLabel="Refresh"
          >
            <RefreshCw size={16} color={theme.textDim} />
          </TouchableOpacity>
        ) : null}

        {needsReviewCount > 0 && (
          <TouchableOpacity
            onPress={handleReviewPress}
            style={styles.reviewBadge}
            activeOpacity={0.8}
          >
            <AlertCircle size={14} color={theme.warn} />
            <Text style={styles.reviewBadgeText}>{needsReviewCount} to review</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 52,
      paddingBottom: 14,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
      ...t.shadows.glow,
    },
    avatarText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '800',
    },
    greeting: {
      color: t.textDim,
      fontSize: 12,
      fontWeight: '600',
    },
    name: {
      color: t.text,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    right: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    refreshBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.cardAlt,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    refreshPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: t.accentLight,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.accentBorder,
    },
    refreshPillText: {
      color: t.accent,
      fontSize: 11,
      fontWeight: '700',
    },
    reviewBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: t.warnLight,
      borderColor: t.warnBorder,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    reviewBadgeText: {
      color: t.warn,
      fontSize: 11,
      fontWeight: '800',
    },
  })
);
