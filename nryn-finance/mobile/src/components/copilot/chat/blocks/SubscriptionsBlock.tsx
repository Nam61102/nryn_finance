import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertCircle, Calendar } from 'lucide-react-native';
import { useTheme } from '../../../../theme';

interface SubscriptionsBlockProps {
  block: {
    type: 'subscriptions';
    count: number;
    totalMonthly: string;
    items: Array<{
      name: string;
      amount: string;
      frequency: string;
      isZombie?: boolean;
      alertReason?: string;
    }>;
  };
}

export default function SubscriptionsBlock({ block }: SubscriptionsBlockProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.cardAlt, borderColor: theme.colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.colors.textDim }]}>
          {block.count} Active Subscriptions
        </Text>
        <Text style={[styles.total, { color: theme.colors.accent }]}>{block.totalMonthly}/mo</Text>
      </View>

      <View style={styles.list}>
        {block.items.map((sub, idx) => (
          <View
            key={idx}
            style={[
              styles.itemRow,
              { borderBottomColor: theme.colors.border },
              sub.isZombie && { backgroundColor: 'rgba(255, 71, 87, 0.08)', borderRadius: 8, paddingHorizontal: 6 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
                  {sub.name}
                </Text>
                {sub.isZombie && <AlertCircle size={14} color="#FF4757" />}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Calendar size={11} color={theme.colors.textDim} />
                <Text style={[styles.freq, { color: theme.colors.textDim }]}>{sub.frequency}</Text>
                {Boolean(sub.alertReason) && (
                  <Text style={[styles.alertReason, { color: '#FF4757' }]} numberOfLines={1}>
                    · {sub.alertReason}
                  </Text>
                )}
              </View>
            </View>
            <Text style={[styles.amount, { color: theme.colors.text }]}>{sub.amount}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  total: {
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    gap: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
  },
  freq: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  alertReason: {
    fontSize: 11,
    fontWeight: '500',
  },
  amount: {
    fontSize: 13,
    fontWeight: '700',
  },
});
