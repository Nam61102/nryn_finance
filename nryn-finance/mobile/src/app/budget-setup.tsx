import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, ActivityIndicator, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Target, Check, TrendingDown, Sparkles, Calendar, DollarSign, ShieldCheck } from 'lucide-react-native';
import { useTheme, makeStyles, Theme } from '../theme';
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

export default function BudgetSetup() {
  const theme = useTheme();
  const styles = useStyles();

  const [data, setData] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Monthly State
  const [selected, setSelected] = useState<string | null>(null);
  const [customMonthly, setCustomMonthly] = useState('');
  
  // Daily State
  const [dailyMode, setDailyMode] = useState<'auto' | 'strict' | 'relaxed' | 'custom'>('auto');
  const [dailyCustom, setDailyCustom] = useState('');
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.budgetSuggestion().catch(() => null),
      api.budgetStatus().catch(() => null),
    ])
      .then(([s, st]: [Suggestion | null, any]) => {
        if (s) {
          setData(s);
          const rec = s.options?.find((o) => o.recommended);
          if (rec) {
            setSelected(rec.key);
            const initialMonthly = rec.amount;
            const initialDaily = Math.round(initialMonthly / 30);
            setDailyCustom(String(initialDaily));
          }
        }
        
        // If user already had a budget in database, pre-fill it
        if (st?.ring?.total && st.ring.total > 0) {
          const existingMonthly = Math.round(st.ring.total / 100);
          setSelected('custom');
          setCustomMonthly(String(existingMonthly));
          
          if (st.dailyBudget && st.dailyBudget > 0) {
            const existingDaily = Math.round(st.dailyBudget / 100);
            setDailyCustom(String(existingDaily));
            setDailyMode('custom');
          } else {
            setDailyCustom(String(Math.round(existingMonthly / 30)));
          }
        } else if (!selected && (!s || !s.options || s.options.length === 0)) {
          setSelected('custom');
          setCustomMonthly('25000');
          setDailyCustom('800');
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const goHome = () => router.replace('/(tabs)');

  const getChosenMonthly = (): number => {
    if (selected === 'custom') return Number(customMonthly.replace(/[^0-9]/g, '')) || 0;
    return data?.options.find((o) => o.key === selected)?.amount || 0;
  };

  const chosenMonthly = getChosenMonthly();
  const autoDaily = Math.round((chosenMonthly > 0 ? chosenMonthly : 25000) / 30);

  // Update daily budget when monthly selection changes or preset is clicked
  const handleSelectMonthly = (key: string, amount?: number) => {
    setSelected(key);
    triggerHaptic('selection');
    const amt = amount || (key === 'custom' ? Number(customMonthly) || 0 : 0);
    if (amt > 0 && dailyMode === 'auto') {
      setDailyCustom(String(Math.round(amt / 30)));
    }
  };

  const handleCustomMonthlyChange = (text: string) => {
    setCustomMonthly(text);
    setSelected('custom');
    const num = Number(text.replace(/[^0-9]/g, '')) || 0;
    if (num > 0 && dailyMode === 'auto') {
      setDailyCustom(String(Math.round(num / 30)));
    }
  };

  const getFinalDaily = (): number => {
    if (dailyMode === 'custom') {
      const parsed = Number(dailyCustom.replace(/[^0-9]/g, ''));
      return parsed > 0 ? parsed : autoDaily;
    }
    if (dailyMode === 'strict') {
      return Math.round(autoDaily * 0.85);
    }
    if (dailyMode === 'relaxed') {
      return Math.round(autoDaily * 1.15);
    }
    return autoDaily;
  };

  const finalDaily = getFinalDaily();

  const handleSelectDailyMode = (mode: 'auto' | 'strict' | 'relaxed' | 'custom') => {
    setDailyMode(mode);
    triggerHaptic('selection');
    if (mode === 'auto') {
      setDailyCustom(String(autoDaily));
    } else if (mode === 'strict') {
      setDailyCustom(String(Math.round(autoDaily * 0.85)));
    } else if (mode === 'relaxed') {
      setDailyCustom(String(Math.round(autoDaily * 1.15)));
    }
  };

  const save = async () => {
    const monthlyAmt = chosenMonthly;
    if (!monthlyAmt || monthlyAmt < 100) {
      triggerHaptic('warning');
      return Alert.alert('Enter Monthly Budget', 'Please choose an option or type your monthly budget.');
    }

    const dailyAmt = finalDaily;
    if (!dailyAmt || dailyAmt < 10) {
      triggerHaptic('warning');
      return Alert.alert('Enter Daily Budget', 'Please enter a valid daily budget.');
    }

    setSaving(true);
    try {
      await Promise.all([
        api.post('/budgets', { scope: 'total', amount: monthlyAmt }),
        api.post('/budgets', { scope: 'daily', amount: dailyAmt }),
      ]);
      triggerHaptic('success');
      Alert.alert(
        '🎯 Budget Configured!',
        `Monthly Budget: ${inr(monthlyAmt)}\nDaily Safe Allowance: ${inr(dailyAmt)}/day\n\nYour AI Copilot will now monitor your live pacing and prevent overspending.`,
        [{ text: 'Continue to Dashboard', onPress: goHome }]
      );
    } catch (err: any) {
      Alert.alert('Could not save', err?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.wrap, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF6D00" />
        <Text style={styles.p}>Loading your real financial baseline…</Text>
      </View>
    );
  }

  const hasHistory = !!data && data.avgMonthlySpend > 0;

  return (
    <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
      {/* HEADER ICON & TITLE */}
      <View style={styles.iconWrap}>
        <Target size={32} color="#FF6D00" />
      </View>
      <Text style={styles.h1}>Set your Monthly & Daily Budget</Text>
      <Text style={styles.p}>
        Configure your monthly spending target and daily safe allowance. We never use fake dummy figures — your limits power your AI Copilot watchdog.
      </Text>

      {/* REAL BANK SPEND INSIGHT */}
      {hasHistory && (
        <View style={styles.insight}>
          <TrendingDown size={18} color="#FF6D00" />
          <Text style={styles.insightText}>
            {data!.basis === 'history'
              ? `You usually spend about ${inr(data!.avgMonthlySpend)} a month (average of ${data!.monthsUsed.map((m) => m.label).join(', ')}).`
              : `At your current pace you'll spend about ${inr(data!.avgMonthlySpend)} this month.`}
            {data!.avgMonthlyIncome > 0 ? ` Average income: ${inr(data!.avgMonthlyIncome)}.` : ''}
          </Text>
        </View>
      )}

      {/* SECTION 1: MONTHLY BUDGET */}
      <View style={styles.sectionHeaderRow}>
        <Calendar size={18} color="#FF6D00" />
        <Text style={styles.sectionTitle}>1. Monthly Total Budget</Text>
      </View>

      {hasHistory &&
        data!.options.map((o) => (
          <PressableScale key={o.key} onPress={() => handleSelectMonthly(o.key, o.amount)}>
            <View style={[styles.option, selected === o.key && styles.optionOn]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.optLabel}>
                  {o.label}
                  {o.recommended ? '  ·  Recommended' : ''}
                </Text>
                <Text style={styles.optAmt}>{inr(o.amount)} / month</Text>
                <Text style={styles.optSub}>≈ {inr(o.amount / 30)} per day</Text>
              </View>
              {selected === o.key && (
                <View style={styles.checkBadge}>
                  <Check size={16} color="#FFFFFF" />
                </View>
              )}
            </View>
          </PressableScale>
        ))}

      {/* CUSTOM MONTHLY INPUT */}
      <PressableScale onPress={() => handleSelectMonthly('custom')}>
        <View style={[styles.option, selected === 'custom' && styles.optionOn]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.optLabel}>{hasHistory ? 'Custom Monthly Amount' : 'Enter your monthly budget'}</Text>
            <View style={styles.inputRow}>
              <Text style={styles.rupeeSymbol}>₹</Text>
              <TextInput
                value={customMonthly}
                onChangeText={handleCustomMonthlyChange}
                onFocus={() => setSelected('custom')}
                placeholder="e.g. 25000"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          </View>
          {selected === 'custom' && (
            <View style={styles.checkBadge}>
              <Check size={16} color="#FFFFFF" />
            </View>
          )}
        </View>
      </PressableScale>

      {/* SECTION 2: DAILY BUDGET (STARTING LA VICHARAYLA YETA) */}
      <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
        <Sparkles size={18} color="#FF6D00" />
        <Text style={styles.sectionTitle}>2. Daily Safe-to-Spend Limit</Text>
      </View>
      <Text style={styles.sectionSub}>
        Your daily allowance is actively monitored. If you exceed this, AI Copilot alerts you before monthly balance drops.
      </Text>

      {/* DAILY PRESET TABS */}
      <View style={styles.dailyPresetsRow}>
        <TouchableOpacity
          style={[styles.presetTab, dailyMode === 'auto' && styles.presetTabOn]}
          onPress={() => handleSelectDailyMode('auto')}
          activeOpacity={0.8}
        >
          <Text style={[styles.presetTabText, dailyMode === 'auto' && styles.presetTabTextOn]}>
            Auto ({inr(autoDaily)}/d)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.presetTab, dailyMode === 'strict' && styles.presetTabOn]}
          onPress={() => handleSelectDailyMode('strict')}
          activeOpacity={0.8}
        >
          <Text style={[styles.presetTabText, dailyMode === 'strict' && styles.presetTabTextOn]}>
            Strict ({inr(Math.round(autoDaily * 0.85))}/d)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.presetTab, dailyMode === 'relaxed' && styles.presetTabOn]}
          onPress={() => handleSelectDailyMode('relaxed')}
          activeOpacity={0.8}
        >
          <Text style={[styles.presetTabText, dailyMode === 'relaxed' && styles.presetTabTextOn]}>
            Flexible ({inr(Math.round(autoDaily * 1.15))}/d)
          </Text>
        </TouchableOpacity>
      </View>

      {/* DAILY BUDGET EDITABLE INPUT */}
      <View style={styles.dailyInputCard}>
        <Text style={styles.dailyCardLabel}>Your Chosen Daily Spending Cap</Text>
        <View style={styles.dailyInputRow}>
          <Text style={styles.dailyRupee}>₹</Text>
          <TextInput
            value={dailyCustom}
            onChangeText={(v) => {
              setDailyCustom(v);
              setDailyMode('custom');
            }}
            placeholder={String(autoDaily)}
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            style={styles.dailyTextInput}
          />
          <Text style={styles.perDaySuffix}>/ day</Text>
        </View>
        <View style={styles.liveSummaryRow}>
          <ShieldCheck size={14} color="#16A34A" />
          <Text style={styles.liveSummaryText}>
            Safe allowance: {inr(finalDaily)} / day ({inr(finalDaily * 30)} projected/mo)
          </Text>
        </View>
      </View>

      {/* SAVE BUTTON */}
      <Button
        title={saving ? 'Saving Budgets…' : 'Save Monthly & Daily Budget'}
        onPress={save}
        loading={saving}
        size="lg"
        variant="primary"
        style={{ marginTop: 24, backgroundColor: '#FF6D00' }}
      />

      {/* SKIP OPTION */}
      <PressableScale onPress={goHome} style={styles.skipWrap}>
        <Text style={styles.skip}>Skip — I'll set it later in Budgets tab</Text>
      </PressableScale>
    </ScrollView>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    wrap: {
      flexGrow: 1,
      padding: 20,
      paddingTop: 56,
      paddingBottom: 40,
      backgroundColor: '#FFFFFF',
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: '#FFF7ED',
      borderWidth: 1.5,
      borderColor: '#FFD7B2',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    h1: {
      color: '#0F172A',
      fontSize: 24,
      fontWeight: '900',
      marginBottom: 6,
      letterSpacing: -0.4,
    },
    p: {
      color: '#64748B',
      fontSize: 13.5,
      lineHeight: 20,
      marginBottom: 16,
    },
    insight: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
      padding: 14,
      borderRadius: 16,
      backgroundColor: '#FFF7ED',
      borderWidth: 1,
      borderColor: '#FFD7B2',
      marginBottom: 20,
    },
    insightText: {
      flex: 1,
      color: '#7C2D12',
      fontSize: 12.5,
      lineHeight: 18,
      fontWeight: '600',
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    sectionTitle: {
      color: '#0F172A',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    sectionSub: {
      color: '#64748B',
      fontSize: 12,
      lineHeight: 17,
      marginBottom: 12,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: '#F1F5F9',
      backgroundColor: '#FFFFFF',
      marginBottom: 10,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 6,
      elevation: 1,
    },
    optionOn: {
      borderColor: '#FF6D00',
      backgroundColor: '#FFFBF7',
    },
    optLabel: {
      color: '#64748B',
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    optAmt: {
      color: '#0F172A',
      fontSize: 18,
      fontWeight: '900',
      marginTop: 2,
    },
    optSub: {
      color: '#E65100',
      fontSize: 11.5,
      fontWeight: '600',
      marginTop: 2,
    },
    checkBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#FF6D00',
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    rupeeSymbol: {
      fontSize: 20,
      fontWeight: '800',
      color: '#0F172A',
      marginRight: 6,
    },
    input: {
      fontSize: 18,
      fontWeight: '800',
      color: '#0F172A',
      flex: 1,
      paddingVertical: 4,
    },
    dailyPresetsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    presetTab: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: 10,
      backgroundColor: '#F8FAFC',
      borderWidth: 1,
      borderColor: '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    presetTabOn: {
      backgroundColor: '#FFF7ED',
      borderColor: '#FF6D00',
    },
    presetTabText: {
      color: '#64748B',
      fontSize: 11,
      fontWeight: '700',
    },
    presetTabTextOn: {
      color: '#FF6D00',
      fontWeight: '800',
    },
    dailyInputCard: {
      backgroundColor: '#FFFBF7',
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: '#FFD7B2',
      padding: 14,
      marginBottom: 12,
    },
    dailyCardLabel: {
      color: '#7C2D12',
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    dailyInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dailyRupee: {
      fontSize: 24,
      fontWeight: '900',
      color: '#FF6D00',
      marginRight: 6,
    },
    dailyTextInput: {
      fontSize: 24,
      fontWeight: '900',
      color: '#0F172A',
      flex: 1,
      paddingVertical: 4,
    },
    perDaySuffix: {
      fontSize: 14,
      fontWeight: '700',
      color: '#64748B',
    },
    liveSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: '#FFE4CC',
    },
    liveSummaryText: {
      color: '#166534',
      fontSize: 11.5,
      fontWeight: '700',
    },
    skipWrap: {
      alignSelf: 'center',
      marginTop: 18,
      paddingVertical: 8,
    },
    skip: {
      color: '#94A3B8',
      fontSize: 13,
      fontWeight: '600',
    },
  })
);
