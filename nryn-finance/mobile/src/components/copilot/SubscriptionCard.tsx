import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { theme } from '../../theme';

interface SubscriptionProps {
  data: {
    count: number;
    totalMonthlyRecurringINR: number;
    totalAnnualCostINR: number;
    potentialAnnualSavingsINR: number;
    subscriptions: any[];
  } | null;
}

export default function SubscriptionCard({ data }: SubscriptionProps) {
  const [expanded, setExpanded] = useState(false);

  if (!data || data.subscriptions?.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.icon}>🕵️‍♂️</Text>
          <Text style={styles.title}>Ghost Subscriptions Hunter</Text>
        </View>
        <Text style={styles.badge}>{data.count} Active</Text>
      </View>

      <Text style={styles.subtitle}>
        You are paying ₹{data.totalMonthlyRecurringINR.toLocaleString('en-IN')}/mo (₹{data.totalAnnualCostINR.toLocaleString('en-IN')}/yr) on recurring services.
      </Text>

      {/* Zombie Savings Callout */}
      {data.potentialAnnualSavingsINR > 0 && (
        <View style={styles.zombieBanner}>
          <Text style={styles.zombieIcon}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.zombieTitle}>Zombie Drain Detected!</Text>
            <Text style={styles.zombieText}>
              Cancel unused services to put <Text style={{ fontWeight: '800', color: '#10B981' }}>₹{data.potentialAnnualSavingsINR.toLocaleString('en-IN')}</Text> back in your pocket annually.
            </Text>
          </View>
        </View>
      )}

      {/* Subscriptions List */}
      <View style={styles.list}>
        {(expanded ? data.subscriptions : data.subscriptions.slice(0, 3)).map((sub) => (
          <View key={sub.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.subName}>{sub.merchantName}</Text>
                {sub.isZombie && <Text style={styles.zombieTag}>UNUSED</Text>}
              </View>
              <Text style={styles.subSub}>
                {sub.frequency.toUpperCase()} · Next: {new Date(sub.nextRenewalAt).toLocaleDateString('en-IN')}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.subAmt}>₹{sub.amountINR.toLocaleString('en-IN')}</Text>
              {sub.cancellationUrl && (
                <TouchableOpacity onPress={() => Linking.openURL(sub.cancellationUrl).catch(() => {})}>
                  <Text style={styles.cancelLink}>Manage →</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>

      {data.subscriptions.length > 3 && (
        <TouchableOpacity style={styles.moreBtn} onPress={() => setExpanded(!expanded)}>
          <Text style={styles.moreText}>
            {expanded ? 'Show Less ↑' : `View All ${data.subscriptions.length} Subscriptions ↓`}
          </Text>
        </TouchableOpacity>
      )}
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontSize: 16 },
  title: { color: theme.text, fontSize: 14, fontWeight: '800' },
  badge: {
    backgroundColor: '#FFF7ED',
    color: theme.accent,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  subtitle: { color: theme.textDim, fontSize: 12, lineHeight: 17, marginBottom: 12 },

  zombieBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  zombieIcon: { fontSize: 16, marginTop: 2 },
  zombieTitle: { color: '#065F46', fontSize: 12, fontWeight: '800' },
  zombieText: { color: '#047857', fontSize: 11, lineHeight: 16, marginTop: 1 },

  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  subName: { color: theme.text, fontSize: 12, fontWeight: '700' },
  zombieTag: {
    backgroundColor: '#FEF2F2',
    color: '#EF4444',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  subSub: { color: theme.textDim, fontSize: 10, marginTop: 2 },
  subAmt: { color: theme.text, fontSize: 13, fontWeight: '800' },
  cancelLink: { color: theme.accent, fontSize: 10, fontWeight: '700', marginTop: 2 },

  moreBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 4 },
  moreText: { color: theme.accent, fontSize: 11, fontWeight: '700' },
});
