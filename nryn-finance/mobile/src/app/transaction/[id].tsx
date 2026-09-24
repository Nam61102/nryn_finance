import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, formatINR } from '../../services/api';
import { theme, FALLBACK_CATEGORIES } from '../../theme';

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [txn, setTxn] = useState<any>(null);
  const [cats, setCats] = useState(FALLBACK_CATEGORIES);

  useEffect(() => {
    api.get<any>(`/transactions/${id}`).then((r) => setTxn(r.transaction));
    api.categories().then((r) => setCats(r.categories)).catch(() => {});
  }, [id]);

  if (!txn) return <View style={styles.center}><Text style={{ color: theme.textDim }}>Loading…</Text></View>;

  const patch = async (body: any) => {
    const r = await api.patch<any>(`/transactions/${id}`, body);
    setTxn(r.transaction);
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingTop: 36, paddingBottom: 40 }}>
      <TouchableOpacity onPress={goBack} style={{ marginBottom: 16 }}>
        <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '600' }}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.amount}>{formatINR(txn.amount, { decimals: true })}</Text>
      <Text style={styles.merchant}>{txn.merchantName || txn.merchantRaw || 'Unknown'}</Text>
      <Text style={styles.meta}>
        {new Date(txn.occurredAt).toLocaleString('en-IN')} · {txn.method} · {txn.account?.bankName || 'unknown bank'}
        {txn.account?.last4 ? ` ••${txn.account.last4}` : ''}
      </Text>

      {txn.needsReview && (
        <View style={styles.review}>
          <Text style={styles.reviewText}>The parser wasn't confident about this one. Check the amount and category.</Text>
        </View>
      )}

      <Text style={styles.label}>Category</Text>
      <View style={styles.catGrid}>
        {cats.map((c) => (
          <TouchableOpacity key={c.key} onPress={() => patch({ category: c.key })} style={[styles.cat, txn.category === c.key && { backgroundColor: c.color }]}>
            <Text style={{ fontSize: 15 }}>{c.icon}</Text>
            <Text style={[styles.catText, txn.category === c.key && { color: '#0B0F0D', fontWeight: '700' }]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>Changing this teaches the app — every future {txn.merchantName || 'payment here'} lands in the same category.</Text>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Counts as an expense</Text>
          <Text style={styles.switchHint}>Turn off for self-transfers, card bill payments and investments.</Text>
        </View>
        <Switch value={txn.isExpense} onValueChange={(v) => patch({ isExpense: v })} trackColor={{ true: theme.accent }} />
      </View>

      <View style={styles.card}>
        <Row k="Source" v={txn.source} />
        <Row k="Parse confidence" v={`${Math.round((txn.parseConfidence || 0) * 100)}%`} />
        <Row k="Category from" v={txn.categorySource} />
        {txn.refId ? <Row k="Reference" v={txn.refId} /> : null}
        {txn.balanceAfter ? <Row k="Balance after" v={formatINR(txn.balanceAfter)} /> : null}
      </View>

      <TouchableOpacity
        style={styles.delete}
        onPress={() => Alert.alert('Delete this transaction?', 'It will stop counting toward your budget.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: async () => { await api.del(`/transactions/${id}`); goBack(); } },
        ])}
      >
        <Text style={{ color: theme.danger, fontWeight: '700' }}>Delete</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <View style={styles.row}><Text style={styles.k}>{k}</Text><Text style={styles.v}>{v}</Text></View>
);

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  amount: { color: theme.text, fontSize: 34, fontWeight: '800' },
  merchant: { color: theme.text, fontSize: 17, marginTop: 6, fontWeight: '600' },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 6 },
  review: { backgroundColor: 'rgba(255,179,0,0.14)', borderRadius: 12, padding: 12, marginTop: 16 },
  reviewText: { color: theme.warn, fontSize: 12, lineHeight: 18 },
  label: { color: theme.textDim, marginTop: 24, marginBottom: 10, fontSize: 13 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.card, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  catText: { color: theme.textDim, fontSize: 12 },
  hint: { color: theme.textDim, fontSize: 11, marginTop: 10, lineHeight: 17 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.card, borderRadius: 16, padding: 14, marginTop: 22 },
  switchLabel: { color: theme.text, fontSize: 14, fontWeight: '600' },
  switchHint: { color: theme.textDim, fontSize: 11, marginTop: 3, lineHeight: 16 },
  card: { backgroundColor: theme.card, borderRadius: 16, padding: 14, marginTop: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  k: { color: theme.textDim, fontSize: 13 },
  v: { color: theme.text, fontSize: 13, fontWeight: '600' },
  delete: { alignItems: 'center', padding: 18, marginTop: 10 },
});
