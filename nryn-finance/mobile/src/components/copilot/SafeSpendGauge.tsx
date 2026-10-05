import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../theme';

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
  if (!data) return null;

  if (!data.hasBudget) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <Text style={styles.icon}>🎯</Text>
            <Text style={styles.title}>Safe-to-Spend Daily Allowance</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
            <Text style={[styles.statusText, { color: '#64748B' }]}>NO BUDGET SET</Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <View>
            <Text style={styles.metricSub}>Spent Today</Text>
            <Text style={[styles.metricMedium, { color: theme.accent }]}>
              ₹{data.todaySpentINR.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.divider} />
          <View>
            <Text style={styles.metricSub}>Spent This Month</Text>
            <Text style={[styles.metricMedium, { color: theme.text }]}>
              ₹{(data.totalSpentSoFarINR || 0).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.promptBtn}
          onPress={() => router.push('/(tabs)/budgets')}
          activeOpacity={0.8}
        >
          <Text style={styles.promptBtnText}>
            🎯 Set monthly budget to unlock daily safe limit →
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor =
    data.burnStatus === 'green' ? '#10B981' : data.burnStatus === 'amber' ? '#F59E0B' : '#FF4757';
  const statusBg =
    data.burnStatus === 'green' ? '#ECFDF5' : data.burnStatus === 'amber' ? '#FFFBEB' : '#FEF2F2';
  const statusBorder =
    data.burnStatus === 'green' ? '#A7F3D0' : data.burnStatus === 'amber' ? '#FDE68A' : '#FECACA';

  const pct = Math.min(100, Math.round((data.todaySpentINR / Math.max(1, data.dailySafeSpendINR)) * 100));

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.icon}>🎯</Text>
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
          <Text style={styles.metricLarge}>₹{data.dailySafeSpendINR.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.divider} />
        <View>
          <Text style={styles.metricSub}>Spent Today</Text>
          <Text style={[styles.metricMedium, { color: statusColor }]}>
            ₹{data.todaySpentINR.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={styles.divider} />
        <View>
          <Text style={styles.metricSub}>Remaining</Text>
          <Text style={[styles.metricMedium, { color: theme.text }]}>
            ₹{data.todayRemainingINR.toLocaleString('en-IN')}
          </Text>
        </View>
      </View>

      {/* Progress Bar Track */}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: statusColor }]} />
      </View>

      <Text style={styles.hintText}>{data.insightMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontSize: 16 },
  title: { color: theme.text, fontSize: 14, fontWeight: '800' },
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
    marginBottom: 10,
  },
  metricSub: { color: theme.textDim, fontSize: 11, fontWeight: '600' },
  metricLarge: { color: theme.text, fontSize: 20, fontWeight: '900', marginTop: 2 },
  metricMedium: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  divider: { width: 1, height: 32, backgroundColor: theme.border },

  track: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  fill: { height: '100%', borderRadius: 3 },
  hintText: { color: theme.textDim, fontSize: 11, lineHeight: 16 },
  promptBtn: {
    marginTop: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
  },
  promptBtnText: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: '700',
  },
});
