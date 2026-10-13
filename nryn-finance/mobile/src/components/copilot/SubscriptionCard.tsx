import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Repeat, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from 'lucide-react-native';
import { useTheme, makeStyles, Theme } from '../../theme';
import { haptic } from '../../utils/haptics';

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
  const theme = useTheme();
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);

  if (!data || (data as any).empty || !data.subscriptions || data.subscriptions.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.titleGroup}>
            <Repeat size={18} color={theme.accent} />
            <Text style={styles.title}>Recurring Subscriptions</Text>
          </View>
          <Text style={styles.badgeZero}>0 Active</Text>
        </View>
        <Text style={styles.emptyText}>
          No recurring payments detected yet. Subscriptions are recognized when repeated charges appear across multiple months.
        </Text>
      </View>
    );
  }

  const toggleExpand = () => {
    haptic.light();
    setExpanded(!expanded);
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <Repeat size={18} color={theme.accent} />
          <Text style={styles.title}>Subscriptions Tracker</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{data.count} Active</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>
        You are paying ₹{data.totalMonthlyRecurringINR.toLocaleString('en-IN')}/mo (₹{data.totalAnnualCostINR.toLocaleString('en-IN')}/yr) on recurring services.
      </Text>

      {/* Zombie Savings Callout */}
      {data.potentialAnnualSavingsINR > 0 && (
        <View style={styles.zombieBanner}>
          <AlertTriangle size={18} color={theme.warn} />
          <View style={{ flex: 1 }}>
            <Text style={styles.zombieTitle}>Review Needed</Text>
            <Text style={styles.zombieText}>
              Cancel unused services to put <Text style={{ fontWeight: '800', color: theme.success }}>₹{data.potentialAnnualSavingsINR.toLocaleString('en-IN')}</Text> back in your pocket annually.
            </Text>
          </View>
        </View>
      )}

      {/* Subscriptions List */}
      <View style={styles.list}>
        {(expanded ? data.subscriptions : data.subscriptions.slice(0, 3)).map((sub) => (
          <View key={sub.id || sub.name} style={styles.subRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.subName}>{sub.name || sub.merchantName}</Text>
                {sub.isZombie && (
                  <View style={styles.zombieBadge}>
                    <Text style={styles.zombieBadgeText}>ALERT</Text>
                  </View>
                )}
              </View>
              <Text style={styles.subMeta}>
                {sub.frequency} · Next: {sub.nextRenewalAt ? new Date(sub.nextRenewalAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Soon'}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.subAmt}>₹{sub.amountINR.toLocaleString('en-IN')}</Text>
              {sub.cancellationUrl && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(sub.cancellationUrl).catch(() => {})}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}
                >
                  <Text style={styles.cancelLink}>Manage</Text>
                  <ExternalLink size={10} color={theme.accent} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>

      {data.subscriptions.length > 3 && (
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={toggleExpand}
          activeOpacity={0.7}
        >
          <Text style={styles.expandText}>
            {expanded ? 'Show Less' : `View All ${data.subscriptions.length} Subscriptions`}
          </Text>
          {expanded ? <ChevronUp size={14} color={theme.accent} /> : <ChevronDown size={14} color={theme.accent} />}
        </TouchableOpacity>
      )}
    </View>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.card,
      borderRadius: t.radius.lg,
      marginHorizontal: 16,
      marginTop: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
      ...t.shadows.sm,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { color: t.text, fontSize: 15, fontWeight: '800' },
    badge: {
      backgroundColor: t.accentLight,
      borderColor: t.accentBorder,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: {
      color: t.accent,
      fontSize: 11,
      fontWeight: '800',
    },
    badgeZero: {
      color: t.textDim,
      backgroundColor: t.cardAlt,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
      fontSize: 11,
      fontWeight: '700',
    },
    subtitle: {
      color: t.textDim,
      fontSize: 12,
      marginBottom: 12,
      lineHeight: 17,
    },
    emptyText: {
      color: t.textDim,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 6,
    },
    zombieBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.warnLight,
      borderWidth: 1,
      borderColor: t.warnBorder,
      borderRadius: t.radius.sm,
      padding: 12,
      marginBottom: 12,
    },
    zombieTitle: { color: t.text, fontSize: 13, fontWeight: '800' },
    zombieText: { color: t.textDim, fontSize: 12, marginTop: 2 },
    list: { gap: 8 },
    subRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.cardAlt,
      padding: 10,
      borderRadius: t.radius.sm,
    },
    subName: { color: t.text, fontSize: 13, fontWeight: '700' },
    subMeta: { color: t.textDim, fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
    subAmt: { color: t.text, fontSize: 13, fontWeight: '800' },
    zombieBadge: {
      backgroundColor: t.dangerLight,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    zombieBadgeText: { color: t.danger, fontSize: 9, fontWeight: '800' },
    cancelLink: { color: t.accent, fontSize: 11, fontWeight: '700' },
    expandBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 10,
      paddingVertical: 6,
    },
    expandText: { color: t.accent, fontSize: 12, fontWeight: '700' },
  })
);
