import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, formatINR } from '../../services/api';
import { theme, FALLBACK_CATEGORIES } from '../../theme';

/**
 * Total and per-category budgets. Total is deliberately NOT forced to equal
 * the sum of categories — the difference is surfaced as "unallocated" instead,
 * because forcing them equal makes editing any single category a fight (§7A).
 */
export default function Budgets() {
  const [status, setStatus] = useState<any>(null);
  const [cats, setCats] = useState(FALLBACK_CATEGORIES);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
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
      await api.post('/budgets', {
        scope,
        category: scope === 'total' ? null : category,
        amount: value,
      });
      await load();
      const label = scope === 'total' ? 'Monthly total budget' : (cats.find(c => c.key === category)?.label || category);
      Alert.alert('Budget Saved', `${label} set to ₹${value.toLocaleString('en-IN')}`);
    } catch (err: any) {
      console.error('Save budget error:', err);
      Alert.alert('Save Failed', err?.message || 'Could not save budget. Please check your connection.');
    } finally {
      setSavingKey(null);
    }
  };

  if (!status) return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>;

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
    >
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.h1}>Budgets</Text>
          <Text style={styles.sub}>{status.period.label} · carries forward every month</Text>
        </View>
        <TouchableOpacity style={styles.headerRefreshBtn} onPress={onRefresh} disabled={refreshing}>
          <Text style={styles.headerRefreshText}>🔄</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.rowLabel}>Total monthly budget</Text>
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
          Unallocated: {formatINR(status.unallocated)} {status.unallocated < 0 ? '(categories exceed your total)' : ''}
        </Text>
      </View>

      <Text style={styles.section}>Per category</Text>
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

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  h1: { color: theme.text, fontSize: 24, fontWeight: '800' },
  sub: { color: theme.textDim, fontSize: 13, marginTop: 6, marginBottom: 18, lineHeight: 19 },
  section: { color: theme.textDim, marginTop: 18, marginBottom: 10, fontSize: 13 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  rowLabel: { color: theme.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rupee: { color: theme.accent, fontSize: 18, fontWeight: '800' },
  input: { flex: 1, color: theme.text, fontSize: 17, fontWeight: '700', paddingVertical: 6 },
  saveBtn: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: theme.accent,
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 2,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerRefreshBtn: {
    padding: 8,
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  headerRefreshText: {
    fontSize: 16,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  hint: { color: theme.textDim, fontSize: 11, marginTop: 8 },
});
