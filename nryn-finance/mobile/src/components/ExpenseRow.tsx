import React from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { formatINR } from '../services/api';

export default function ExpenseRow({ txn, onPress }: { txn: any; onPress?: () => void }) {
  const d = new Date(txn.occurredAt);
  const when = d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.icon}><Text style={{ fontSize: 20 }}>{txn.merchantIcon || '📦'}</Text></View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.name} numberOfLines={1}>{txn.merchantName || txn.merchantRaw || 'Unknown'}</Text>
          {/* needsReview is visible HERE, not buried in a filter — these are the
              rows that make the total wrong, so they stay one tap from the ring. */}
          {txn.needsReview && <View style={styles.dot} />}
          {txn.source === 'manual' && <Text style={styles.tag}>manual</Text>}
        </View>
        <Text style={styles.when}>{when}</Text>
      </View>
      <Text style={[styles.amount, txn.direction === 'credit' && { color: theme.accent }]}>
        {txn.direction === 'credit' ? '+' : ''}{formatINR(txn.amount)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: theme.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  when: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  amount: { color: theme.text, fontSize: 16, fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.warn },
  tag: { color: theme.textDim, fontSize: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 5, paddingHorizontal: 4 },
});
