import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { RefreshCw, ShieldCheck } from 'lucide-react-native';
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
  const styles = useStyles();

  const displayName = userName === 'there' || !userName ? 'Namrata Kadam' : userName;
  const parts = displayName.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : (displayName.length >= 2 ? displayName.slice(0, 2).toUpperCase() : 'NK');

  return (
    <View style={styles.header}>
      {/* 1. Sleek Brand & Autonomous Agent Indicator */}
      <View style={styles.brandWrap}>
        <View style={styles.titleRow}>
          <Text style={styles.brandTitle}>NRYN</Text>
          <Text style={styles.brandAccent}>AI</Text>
        </View>
        <View style={styles.liveIndicator}>
          <View style={styles.pulseDot} />
          <Text style={styles.liveText}>AUTONOMOUS COPILOT</Text>
        </View>
      </View>

      {/* 2. Proper Header Right Actions (Sync Button & Profile Avatar) */}
      <View style={styles.right}>
        {onRefresh && (
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => {
              haptic.light();
              onRefresh();
            }}
            disabled={refreshing}
            activeOpacity={0.7}
            accessibilityLabel="Refresh and sync transactions"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#FF6D00" />
            ) : (
              <RefreshCw size={16} color="#FF6D00" />
            )}
          </TouchableOpacity>
        )}

        {/* Profile Avatar */}
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => {
            haptic.light();
            router.push('/(tabs)/profile');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </TouchableOpacity>
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
      paddingTop: 50,
      paddingBottom: 12,
      backgroundColor: 'transparent',
    },
    brandWrap: {
      gap: 2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    brandTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: '#0F172A',
      letterSpacing: -0.5,
    },
    brandAccent: {
      fontSize: 22,
      fontWeight: '900',
      color: '#FF6D00',
      letterSpacing: -0.5,
    },
    liveIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    pulseDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#FF6D00',
    },
    liveText: {
      fontSize: 9.5,
      fontWeight: '800',
      color: '#FF6D00',
      letterSpacing: 0.8,
    },
    right: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    refreshBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    avatarBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#FFF7ED',
      borderWidth: 1.5,
      borderColor: '#FFD7B2',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#FF6D00',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    avatarText: {
      color: '#FF6D00',
      fontSize: 16,
      fontWeight: '900',
    },
  })
);
