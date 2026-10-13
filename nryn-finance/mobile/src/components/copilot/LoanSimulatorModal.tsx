import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Calculator } from 'lucide-react-native';
import { useTheme, makeStyles, Theme } from '../../theme';
import { api } from '../../services/api';
import { haptic } from '../../utils/haptics';

export default function LoanSimulatorModal() {
  const theme = useTheme();
  const styles = useStyles();

  const [loans, setLoans] = useState<any[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  const [principalStr, setPrincipalStr] = useState('');
  const [interestRateStr, setInterestRateStr] = useState('');
  const [tenureYearsStr, setTenureYearsStr] = useState('');
  const [extraPrepay, setExtraPrepay] = useState(2000);

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user's real loan accounts if available
  useEffect(() => {
    api.getAccounts()
      .then((res) => {
        const userLoans = res.loans || res.accounts?.filter((a: any) => a.type === 'loan') || [];
        setLoans(userLoans);
        if (userLoans.length > 0) {
          const l = userLoans[0];
          setSelectedLoanId(l._id);
          const p = Math.round((l.principalAmount || l.outstandingAmount || 0) / 100);
          if (p > 0) setPrincipalStr(String(p));
          if (l.interestRate) setInterestRateStr(String(l.interestRate));
          if (l.tenureMonths) setTenureYearsStr(String(Math.round(l.tenureMonths / 12)));
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectLoan = (loan: any) => {
    haptic.light();
    setSelectedLoanId(loan._id);
    const p = Math.round((loan.principalAmount || loan.outstandingAmount || 0) / 100);
    if (p > 0) setPrincipalStr(String(p));
    if (loan.interestRate) setInterestRateStr(String(loan.interestRate));
    if (loan.tenureMonths) setTenureYearsStr(String(Math.round(loan.tenureMonths / 12)));
  };

  const calculate = async (extra: number = extraPrepay) => {
    const principal = Number(principalStr.replace(/,/g, '').trim());
    const rate = Number(interestRateStr.trim());
    const tenureYears = Number(tenureYearsStr.trim());

    if (!principal || principal <= 0) {
      setError('Please enter a valid loan principal amount');
      setResult(null);
      return;
    }
    if (!rate || rate <= 0) {
      setError('Please enter annual interest rate (e.g. 8.5)');
      setResult(null);
      return;
    }
    if (!tenureYears || tenureYears <= 0) {
      setError('Please enter tenure in years (e.g. 15)');
      setResult(null);
      return;
    }

    setError(null);
    setLoading(true);
    haptic.medium();

    try {
      const res = await api.simulateLoan({
        principalAmount: principal,
        annualInterestRate: rate,
        tenureMonths: Math.round(tenureYears * 12),
        extraMonthlyPrepayment: extra,
      });
      setResult(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to simulate loan');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (principalStr && interestRateStr && tenureYearsStr) {
      calculate(extraPrepay);
    }
  }, [extraPrepay]);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <Calculator size={18} color={theme.accent} />
          <Text style={styles.title}>Loan Prepayment & EMI Saver</Text>
        </View>
        <Text style={styles.badge}>Simulator</Text>
      </View>

      <Text style={styles.subtitle}>
        Calculate how much total interest and tenure you save by adding an extra prepayment each month.
      </Text>

      {/* Real Loan Selector if user has loans */}
      {loans.length > 0 && (
        <View style={styles.loanSelectorSection}>
          <Text style={styles.fieldLabel}>Select Recorded Loan:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.loanChipsScroll}>
            {loans.map((l) => (
              <TouchableOpacity
                key={l._id}
                style={[styles.loanChip, selectedLoanId === l._id && styles.loanChipActive]}
                onPress={() => handleSelectLoan(l)}
              >
                <Text style={[styles.loanChipText, selectedLoanId === l._id && styles.loanChipTextActive]}>
                  {l.bankName} {l.loanType ? `(${l.loanType})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Inputs */}
      <View style={styles.inputGrid}>
        <View style={styles.inputCol}>
          <Text style={styles.inputLabel}>Principal (₹)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={principalStr}
            onChangeText={setPrincipalStr}
            placeholder="e.g. 2500000"
            placeholderTextColor={theme.textDim}
          />
        </View>

        <View style={styles.inputCol}>
          <Text style={styles.inputLabel}>Interest Rate (%)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={interestRateStr}
            onChangeText={setInterestRateStr}
            placeholder="e.g. 8.5"
            placeholderTextColor={theme.textDim}
          />
        </View>

        <View style={styles.inputCol}>
          <Text style={styles.inputLabel}>Tenure (Yrs)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={tenureYearsStr}
            onChangeText={setTenureYearsStr}
            placeholder="e.g. 20"
            placeholderTextColor={theme.textDim}
          />
        </View>
      </View>

      {/* Quick Extra Prepayment Selectors */}
      <Text style={styles.fieldLabel}>Extra Monthly Prepayment (₹):</Text>
      <View style={styles.chipRow}>
        {[1000, 2000, 5000, 10000].map((amt) => (
          <TouchableOpacity
            key={amt}
            style={[styles.chip, extraPrepay === amt && styles.chipActive]}
            onPress={() => {
              haptic.light();
              setExtraPrepay(amt);
            }}
          >
            <Text style={[styles.chipText, extraPrepay === amt && styles.chipTextActive]}>
              +₹{amt.toLocaleString('en-IN')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.calcBtn}
        onPress={() => calculate(extraPrepay)}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.calcBtnText}>Calculate Savings</Text>
        )}
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Results View */}
      {result && (
        <View style={styles.resultBox}>
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricSub}>Interest Saved</Text>
              <Text style={styles.metricGreen}>
                ₹{result.totalInterestSavedINR.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.metricMicro}>Over entire loan tenure</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricSub}>Tenure Reduced</Text>
              <Text style={styles.metricOrange}>
                {result.yearsSaved > 0
                  ? `${result.yearsSaved}y ${result.monthsSaved % 12}m`
                  : `${result.monthsSaved} months`}
              </Text>
              <Text style={styles.metricMicro}>Debt-free earlier</Text>
            </View>
          </View>

          <Text style={styles.recText}>✨ {result.recommendation}</Text>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.card,
      borderRadius: t.radius.lg,
      marginTop: 16,
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
      color: t.accent,
      borderWidth: 1,
      borderColor: t.accentBorder,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      fontSize: 10,
      fontWeight: '800',
    },
    subtitle: {
      color: t.textDim,
      fontSize: 12,
      marginBottom: 12,
      lineHeight: 17,
    },
    loanSelectorSection: { marginBottom: 10 },
    loanChipsScroll: { flexDirection: 'row', marginTop: 4 },
    loanChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: t.cardAlt,
      borderWidth: 1,
      borderColor: t.border,
      marginRight: 8,
    },
    loanChipActive: {
      backgroundColor: t.accentLight,
      borderColor: t.accent,
    },
    loanChipText: { color: t.textDim, fontSize: 11, fontWeight: '700' },
    loanChipTextActive: { color: t.accent, fontWeight: '800' },
    inputGrid: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    inputCol: { flex: 1 },
    inputLabel: { color: t.textDim, fontSize: 10, fontWeight: '700', marginBottom: 4 },
    input: {
      backgroundColor: t.cardAlt,
      borderRadius: t.radius.sm,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 8,
      paddingVertical: 8,
      fontSize: 13,
      fontWeight: '700',
      color: t.text,
    },
    fieldLabel: { color: t.text, fontSize: 12, fontWeight: '700', marginBottom: 6 },
    chipRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    chip: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 10,
      backgroundColor: t.cardAlt,
      borderWidth: 1,
      borderColor: t.border,
    },
    chipActive: {
      backgroundColor: t.accentLight,
      borderColor: t.accent,
    },
    chipText: { color: t.textDim, fontSize: 11, fontWeight: '700' },
    chipTextActive: { color: t.accent, fontWeight: '800' },
    calcBtn: {
      backgroundColor: t.accent,
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: 'center',
      marginBottom: 10,
    },
    calcBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    errorText: { color: t.danger, fontSize: 11, textAlign: 'center', marginBottom: 8 },
    resultBox: {
      backgroundColor: t.cardAlt,
      borderRadius: t.radius.md,
      padding: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    metricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    metricItem: { alignItems: 'center' },
    metricSub: { color: t.textDim, fontSize: 11, fontWeight: '600' },
    metricGreen: { color: t.success, fontSize: 18, fontWeight: '900', marginTop: 2 },
    metricOrange: { color: t.accent, fontSize: 18, fontWeight: '900', marginTop: 2 },
    metricMicro: { color: t.textDim, fontSize: 10, marginTop: 1 },
    divider: { width: 1, height: 32, backgroundColor: t.border },
    recText: { color: t.text, fontSize: 11, lineHeight: 16, marginTop: 10, textAlign: 'center' },
  })
);
