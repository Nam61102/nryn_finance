import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
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

  const load = useCallback(async () => {
    const [st, c] = await Promise.all([api.budgetStatus(), api.categories().catch(() => ({ categories: FALLBACK_CATEGORIES }))]);
    setStatus(st);
    setCats(c.categories);
    const d: Record<string, string> = { total: String((st.ring.total || 0) / 100) };
    for (const chip of st.chips) d[chip.category] = String(chip.budget / 100);
    setDraft(d);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async (scope: 'total' | 'category', category?: string) => {
    const key = scope === 'total' ? 'total' : category!;
    const value = Number(draft[key]);
    if (Number.isNaN(value) || value < 0) return Alert.alert('Enter a valid amount');
    await api.post('/budgets', { scope, category: scope === 'total' ? null : category, amount: value });
    load();
  };

  if (!status) return <View style={styles.center}><Text style={{ color: theme.textDim }}>Loading…</Text></View>;

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 40 }}>
      <Text style={styles.h1}>Budgets</Text>
      <Text style={styles.sub}>{status.period.label} · these carry forward to every month unless you override one.</Text>

      <View style={styles.card}>
        <Text style={styles.rowLabel}>Total monthly budget</Text>
        <View style={styles.inputRow}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={draft.total} onChangeText={(v) => setDraft({ ...draft, total: v })} placeholderTextColor={theme.textDim} placeholder="0" />
          <TouchableOpacity style={styles.saveBtn} onPress={() => save('total')}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
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
            <TouchableOpacity style={styles.saveBtn} onPress={() => save('category', c.key)}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
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
  card: { backgroundColor: theme.card, borderRadius: 16, padding: 14, marginBottom: 10 },
  rowLabel: { color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rupee: { color: theme.textDim, fontSize: 18 },
  input: { flex: 1, color: theme.text, fontSize: 17, fontWeight: '700', paddingVertical: 6 },
  saveBtn: { backgroundColor: theme.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  saveText: { color: '#0B0F0D', fontWeight: '700', fontSize: 13 },
  hint: { color: theme.textDim, fontSize: 11, marginTop: 8 },
});
