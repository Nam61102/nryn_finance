import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';

interface AnomalyProps {
  anomalies: any[];
}

export default function AnomalyAlertBanner({ anomalies }: AnomalyProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !anomalies || anomalies.length === 0) return null;

  const top = anomalies[0];
  const isDoubleDebit = top.type === 'double_debit';

  return (
    <View style={[styles.banner, isDoubleDebit && styles.bannerHigh]}>
      <View style={styles.topRow}>
        <View style={styles.left}>
          <Text style={styles.icon}>{isDoubleDebit ? '🚨' : '⚠️'}</Text>
          <Text style={styles.title}>{top.title}</Text>
        </View>
        <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.desc}>{top.description}</Text>

      {top.suggestedAction && (
        <View style={styles.actionBox}>
          <Text style={styles.actionLabel}>💡 Recommendation:</Text>
          <Text style={styles.actionText}>{top.suggestedAction}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
  },
  bannerHigh: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontSize: 16 },
  title: { color: theme.text, fontSize: 13, fontWeight: '800' },
  close: { color: theme.textDim, fontSize: 12, fontWeight: '700', padding: 2 },
  desc: { color: theme.textDim, fontSize: 12, lineHeight: 17, marginTop: 2 },
  actionBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  actionLabel: { color: theme.text, fontSize: 11, fontWeight: '700' },
  actionText: { color: theme.textDim, fontSize: 11, marginTop: 1 },
});
