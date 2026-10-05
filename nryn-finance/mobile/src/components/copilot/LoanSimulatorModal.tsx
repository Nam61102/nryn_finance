import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';
import { api } from '../../services/api';

export default function LoanSimulatorModal() {
  const [extraPrepay, setExtraPrepay] = useState(2000);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    runSim(extraPrepay);
  }, [extraPrepay]);

  const runSim = (extra: number) => {
    api.simulateLoan({
      principalAmount: 3500000,
      annualInterestRate: 8.5,
      tenureMonths: 240,
      extraMonthlyPrepayment: extra,
    }).then(setResult).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.icon}>💡</Text>
          <Text style={styles.title}>Loan Prepayment & EMI Saver</Text>
        </View>
        <Text style={styles.badge}>Interest Hack</Text>
      </View>

      <Text style={styles.subtitle}>
        See how much interest you save on your loan (e.g. ₹35L @ 8.5%) by paying a little extra each month.
      </Text>

      {/* Preset Extra Buttons */}
      <Text style={styles.fieldLabel}>Extra Monthly Prepayment:</Text>
      <View style={styles.chipRow}>
        {[1000, 2000, 3500, 5000].map((amt) => (
          <TouchableOpacity
            key={amt}
            style={[styles.chip, extraPrepay === amt && styles.chipActive]}
            onPress={() => setExtraPrepay(amt)}
          >
            <Text style={[styles.chipText, extraPrepay === amt && styles.chipTextActive]}>
              +₹{amt.toLocaleString('en-IN')}/mo
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Simulation Result Callout */}
      {result && (
        <View style={styles.resultBox}>
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricSub}>Interest Saved</Text>
              <Text style={styles.metricGreen}>
                ₹{(result.totalInterestSavedINR || 0).toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricSub}>Tenure Reduced</Text>
              <Text style={styles.metricOrange}>
                {result.yearsSaved} Years
              </Text>
              <Text style={styles.metricMicro}>({result.monthsSaved} fewer EMIs)</Text>
            </View>
          </View>

          <Text style={styles.recText}>{result.recommendation}</Text>
        </View>
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

  fieldLabel: { color: theme.text, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  chip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: theme.accent,
  },
  chipText: { color: theme.textDim, fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: theme.accent, fontWeight: '800' },

  resultBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  metricItem: { alignItems: 'center' },
  metricSub: { color: theme.textDim, fontSize: 11, fontWeight: '600' },
  metricGreen: { color: '#10B981', fontSize: 18, fontWeight: '900', marginTop: 2 },
  metricOrange: { color: theme.accent, fontSize: 18, fontWeight: '900', marginTop: 2 },
  metricMicro: { color: theme.textDim, fontSize: 10, marginTop: 1 },
  divider: { width: 1, height: 32, backgroundColor: theme.border },

  recText: { color: theme.text, fontSize: 11, lineHeight: 16, marginTop: 10, textAlign: 'center' },
});
