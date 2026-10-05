import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import { api } from '../../services/api';

export default function TaxRadarWidget() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.getTaxRadar().then(setData).catch(() => {});
  }, []);

  if (!data) return null;

  const pct80C = data.section80C?.percentage || 0;
  const pct80D = data.section80D?.percentage || 0;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.icon}>📑</Text>
          <Text style={styles.title}>80C & 80D Tax Radar</Text>
        </View>
        <Text style={styles.badge}>FY {data.financialYear || '2026-27'}</Text>
      </View>

      <Text style={styles.subtitle}>
        Automated tax deductions discovery from your insurance policies & investments.
      </Text>

      {/* 80C Bar */}
      <View style={styles.sectionBlock}>
        <View style={styles.barLabelRow}>
          <Text style={styles.secTitle}>Section 80C (PPF / ELSS / Life Ins)</Text>
          <Text style={styles.secVal}>
            ₹{(data.section80C?.utilizedINR || 0).toLocaleString('en-IN')} / ₹1.5L
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct80C}%`, backgroundColor: '#38BDF8' }]} />
        </View>
      </View>

      {/* 80D Bar */}
      <View style={styles.sectionBlock}>
        <View style={styles.barLabelRow}>
          <Text style={styles.secTitle}>Section 80D (Health Insurance)</Text>
          <Text style={styles.secVal}>
            ₹{(data.section80D?.utilizedINR || 0).toLocaleString('en-IN')} / ₹25,000
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct80D}%`, backgroundColor: '#10B981' }]} />
        </View>
      </View>

      {/* Actionable Tax Tip Banner */}
      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>💡 Tax Saving Opportunity:</Text>
        <Text style={styles.tipText}>{data.actionableTip}</Text>
      </View>
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
    backgroundColor: '#ECFDF5',
    color: '#065F46',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  subtitle: { color: theme.textDim, fontSize: 12, lineHeight: 17, marginBottom: 12 },

  sectionBlock: { marginBottom: 10 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  secTitle: { color: theme.text, fontSize: 11, fontWeight: '700' },
  secVal: { color: theme.textDim, fontSize: 11, fontWeight: '700' },
  track: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },

  tipBox: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    padding: 10,
    marginTop: 6,
  },
  tipTitle: { color: theme.accent, fontSize: 11, fontWeight: '800', marginBottom: 2 },
  tipText: { color: theme.text, fontSize: 11, lineHeight: 16 },
});
