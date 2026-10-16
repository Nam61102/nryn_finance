import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { Target, Check, TrendingDown } from 'lucide-react-native';
import { useTheme, makeStyles } from '../theme';
import Button from '../components/ui/Button';
import PressableScale from '../components/ui/PressableScale';
import { api } from '../services/api';
import { triggerHaptic } from '../utils/haptics';

type Suggestion = {
  basis: 'history' | 'projection' | 'none';
  monthsUsed: { month: string; label: string; spent: number }[];
  avgMonthlySpend: number;
  avgMonthlyIncome: number;
  options: { key: string; label: string; amount: number; recommended?: boolean }[];
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * Shown right after the SMS scan. The budget is ALWAYS the user's choice —
 * we only suggest numbers based on their own real spending. Skip = no budget.
 */
export default function BudgetSetup() {
  const theme = useTheme();
  const styles = useStyles();
  const [data, setData] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .budgetSuggestion()
      .then((s: Suggestion) => {
        setData(s);
        const rec = s.options.find((o: Suggestion['options'][number]) => o.recommended);
        if (rec) setSelected(rec.key);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const goHome = () => router.replace('/(tabs)');

  const chosenAmount = (): number => {
    if (selected === 'custom') return Number(custom.replace(/[^0-9]/g, '')) || 0;
    return data?.options.find((o) => o.key === selected)?.amount || 0;
  };

  const save = async () => {
    const amount = chosenAmount();
    if (!amount || amount < 100) {
      triggerHaptic('warning');
      return Alert.alert('Enter a budget', 'Please choose an option or type your monthly budget.');
    }
    setSaving(true);
    try {
      await api.post('/budgets', { scope: 'total', amount });
      triggerHaptic('success');
      goHome();
    } catch (err: any) {
      Alert.alert('Could not save', err?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.wrap, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={styles.p}>Analysing your real spending…</Text>
      </View>
    );
  }

  const hasHistory = !!data && data.avgMonthlySpend > 0;

  return (
    <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
      <View style={styles.iconWrap}>
        <Target size={34} color={theme.colors.accent} />
      </View>
      <Text style={styles.h1}>Set your monthly budget</Text>
      <Text style={styles.p}>
        Your budget is your choice. We never set one for you — we only suggest numbers from your own bank SMS.
      </Text>

      {hasHistory && (
        <View style={styles.insight}>
          <TrendingDown size={18} color={theme.colors.accent} />
          <Text style={styles.insightText}>
            {data!.basis === 'history'
              ? `You usually spend about ${inr(data!.avgMonthlySpend)} a month (average of ${data!.monthsUsed.map((m) => m.label).join(', ')}).`
              : `At your current pace you'll spend about ${inr(data!.avgMonthlySpend)} this month.`}
            {data!.avgMonthlyIncome > 0 ? ` Average income: ${inr(data!.avgMonthlyIncome)}.` : ''}
          </Text>
        </View>
      )}

      {hasHistory &&
        data!.options.map((o) => (
          <PressableScale key={o.key} onPress={() => setSelected(o.key)}>
            <View style={[styles.option, selected === o.key && styles.optionOn]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.optLabel}>
                  {o.label}
                  {o.recommended ? '  ·  Recommended' : ''}
                </Text>
                <Text style={styles.optAmt}>{inr(o.amount)} / month</Text>
                <Text style={styles.optSub}>≈ {inr(o.amount / 30)} per day</Text>
              </View>
              {selected === o.key && <Check size={20} color={theme.colors.accent} />}
            </View>
          </PressableScale>
        ))}

      <PressableScale onPress={() => setSelected('custom')}>
        <View style={[styles.option, selected === 'custom' && styles.optionOn]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.optLabel}>{hasHistory ? 'My own amount' : 'Enter your monthly budget'}</Text>
            <TextInput
              value={custom}
              onChangeText={(v) => {
                setCustom(v);
                setSelected('custom');
              }}
              onFocus={() => setSelected('custom')}
              placeholder="e.g. 15000"
              placeholderTextColor={theme.colors.textDim}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
        </View>
      </PressableScale>

      <Button title={saving ? 'Saving…' : 'Save budget'} onPress={save} loading={saving} size="lg" variant="primary" style={{ marginTop: 16 }} />

      <PressableScale onPress={goHome} style={styles.skipWrap}>
        <Text style={styles.skip}>Skip — I'll set it later (no budget)</Text>
      </PressableScale>
    </ScrollView>
  );
}

const useStyles = makeStyles((t: any) => ({
  wrap: { flexGrow: 1, padding: 24, paddingTop: 64, backgroundColor: t.colors.bg },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: t.colors.accentLight || '#FFF3E0',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  h1: { color: t.colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8, letterSpacing: -0.5 },
  p: { color: t.colors.textDim, fontSize: 14, lineHeight: 22, marginBottom: 20, marginTop: 8 },
  insight: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 16,
    backgroundColor: t.colors.accentLight || '#FFF7ED', marginBottom: 16,
  },
  insightText: { flex: 1, color: t.colors.text, fontSize: 13, lineHeight: 19 },
  option: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5,
    borderColor: t.colors.border, backgroundColor: t.colors.card, marginBottom: 10,
  },
  optionOn: { borderColor: t.colors.accent },
  optLabel: { color: t.colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  optAmt: { color: t.colors.text, fontSize: 20, fontWeight: '800', marginTop: 4 },
  optSub: { color: t.colors.textDim, fontSize: 12, marginTop: 2 },
  input: {
    marginTop: 8, fontSize: 20, fontWeight: '700', color: t.colors.text, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: t.colors.border,
  },
  skipWrap: { alignSelf: 'center', marginTop: 18, paddingVertical: 8 },
  skip: { color: t.colors.textDim, fontSize: 13, fontWeight: '500' },
}));
