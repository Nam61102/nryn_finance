import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { RefreshCw, Check } from 'lucide-react-native';
import { api } from '../../services/api';
import { useTheme, makeStyles, Theme, FALLBACK_CATEGORIES } from '../../theme';
import { formatINR } from '../../utils/format';
import { haptic } from '../../utils/haptics';
import BudgetRing from '../../components/BudgetRing';
import { BudgetsSkeleton } from '../../components/skeletons';

export default function Budgets() {
  const theme = useTheme();
  const styles = useStyles();

  const [status, setStatus] = useState<any>(null);
  const [cats, setCats] = useState(FALLBACK_CATEGORIES);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [st, c] = await Promise.all([
        api.budgetStatus(),
        api.categories().catch(() => ({ categories: FALLBACK_CATEGORIES })),
      ]);
      setStatus(st);
      setCats(c.categories);
      const d: Record<string, string> = { total: String(Math.round((st.ring.total || 0) / 100)) };
      for (const chip of st.chips) d[chip.category] = String(Math.round(chip.budget / 100));
      setDraft(d);
    } catch (err: any) {
      console.error('Failed to load budgets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    haptic.light();
    await load();
    setRefreshing(false);
  };

  const save = async (scope: 'total' | 'category', category?: string) => {
    const key = scope === 'total' ? 'total' : category!;
    const rawVal = String(draft[key] || '').replace(/,/g, '').trim();
    if (rawVal === '') {
      return Alert.alert('Invalid Amount', 'Please enter an amount to save.');
    }
    const value = Number(rawVal);
    if (Number.isNaN(value) || value < 0) {
      return Alert.alert('Invalid Amount', 'Please enter a valid positive number.');
    }

    try {
      setSavingKey(key);
      haptic.medium();
      await api.post('/budgets', {
        scope,
        category: scope === 'total' ? null : category,
        amount: value,
      });
      await load();
      haptic.success();
      const label = scope === 'total' ? 'Monthly total budget' : (cats.find(c => c.key === category)?.label || category);
      Alert.alert('✅ Budget Saved', `${label} set to ₹${value.toLocaleString('en-IN')}`);
    } catch (err: any) {
      haptic.error();
      console.error('Save budget error:', err);
      Alert.alert('Save Failed', err?.message || 'Could not save budget. Please check your connection.');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading && !status) return <BudgetsSkeleton />;

  const ring = status?.ring;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.accent}
          colors={[theme.accent]}
        />
      }
    >
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.h1}>Budgets & Limits</Text>
          <Text style={styles.sub}>{status?.period?.label || 'Current Month'} · Carries forward monthly</Text>
        </View>
        <TouchableOpacity
          style={styles.headerRefreshBtn}
          onPress={onRefresh}
          disabled={refreshing}
          activeOpacity={0.7}
        >
          <RefreshCw size={18} color={theme.textDim} />
        </TouchableOpacity>
      </View>

      {/* Interactive Budget Ring */}
      {ring && ring.total > 0 && (
        <View style={styles.ringCard}>
          <BudgetRing
            total={ring.total}
            spent={ring.spent}
            remaining={ring.remaining}
            ratio={ring.ratio}
            over={ring.over}
          />
        </View>
      )}

      {/* Monthly Total Budget Card */}
      <View style={styles.card}>
        <Text style={styles.rowLabel}>Total Monthly Budget</Text>
        <View style={styles.inputRow}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={draft.total}
            onChangeText={(v) => setDraft({ ...draft, total: v })}
            placeholderTextColor={theme.textDim}
            placeholder="0"
          />
          <TouchableOpacity
            style={[styles.saveBtn, savingKey === 'total' && styles.saveBtnDisabled]}
            onPress={() => save('total')}
            disabled={savingKey !== null}
            activeOpacity={0.8}
          >
            {savingKey === 'total' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Unallocated: {formatINR(status?.unallocated || 0)} {status?.unallocated < 0 ? '(categories exceed your total)' : ''}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Category Allocations</Text>
      {cats.filter((c) => !['income', 'transfer'].includes(c.key)).map((c) => (
        <View key={c.key} style={styles.card}>
          <Text style={styles.rowLabel}>{c.icon}  {c.label}</Text>
          <View style={styles.inputRow}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={draft[c.key] ?? ''}
              onChangeText={(v) => setDraft({ ...draft, [c.key]: v })}
              placeholder="0"
              placeholderTextColor={theme.textDim}
            />
            <TouchableOpacity
              style={[styles.saveBtn, savingKey === c.key && styles.saveBtnDisabled]}
              onPress={() => save('category', c.key)}
              disabled={savingKey !== null}
              activeOpacity={0.8}
            >
              {savingKey === c.key ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, paddingTop: 52, paddingBottom: 40 },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    h1: { color: t.text, fontSize: 24, fontWeight: '800' },
    sub: { color: t.textDim, fontSize: 13, marginTop: 4, lineHeight: 18 },
    headerRefreshBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: t.cardAlt,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringCard: {
      backgroundColor: t.card,
      borderRadius: t.radius.xl,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: t.border,
      ...t.shadows.sm,
      alignItems: 'center',
    },
    sectionTitle: {
      color: t.textDim,
      marginTop: 18,
      marginBottom: 10,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    card: {
      backgroundColor: t.card,
      borderRadius: t.radius.md,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: t.border,
      ...t.shadows.sm,
    },
    rowLabel: { color: t.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rupee: { color: t.accent, fontSize: 20, fontWeight: '800' },
    input: {
      flex: 1,
      color: t.text,
      fontSize: 18,
      fontWeight: '800',
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: t.cardAlt,
      borderRadius: t.radius.sm,
      borderWidth: 1,
      borderColor: t.border,
    },
    saveBtn: {
      backgroundColor: t.accent,
      borderRadius: t.radius.sm,
      paddingHorizontal: 16,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      ...t.shadows.sm,
    },
    saveBtnDisabled: {
      opacity: 0.6,
    },
    saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
    hint: { color: t.textDim, fontSize: 11, marginTop: 8 },
  })
);
