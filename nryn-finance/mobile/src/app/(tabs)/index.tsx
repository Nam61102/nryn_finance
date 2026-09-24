import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../services/api';
import { syncSms } from '../../sync/sms.sync';
import { theme } from '../../theme';
import BudgetRing from '../../components/BudgetRing';
import MonthSwitcher from '../../components/MonthSwitcher';
import CategoryChip from '../../components/CategoryChip';
import ExpenseRow from '../../components/ExpenseRow';
import PaceBanner from '../../components/PaceBanner';

const SORTS = [
  { key: 'amount_desc', label: 'Highest' },
  { key: 'amount_asc', label: 'Lowest' },
  { key: 'date_desc', label: 'Newest' },
  { key: 'date_asc', label: 'Oldest' },
];

export default function Home() {
  const [months, setMonths] = useState<any[]>([]);
  const [month, setMonth] = useState<string>('');
  const [status, setStatus] = useState<any>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [sort, setSort] = useState('date_desc');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (m?: string) => {
    try {
      const [mo, st, tx] = await Promise.all([
        api.months(),
        api.budgetStatus(m),
        api.transactions({ month: m, sort, limit: '30' }),
      ]);
      setMonths(mo.months);
      setStatus(st);
      setMonth(st.period.month);
      setTxns(tx.transactions);
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => { load(month || undefined); }, [sort]);

  // Sync on open is the GUARANTEED trigger — background fetch is a bonus.
  useFocusEffect(useCallback(() => { syncSms().finally(() => load(month || undefined)); }, [month]));

  const onRefresh = async () => {
    setRefreshing(true);
    await syncSms();               // pull-to-refresh does a REAL SMS sync
    await load(month || undefined);
    setRefreshing(false);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>;
  }

  const ring = status?.ring;
  const noBudget = !ring?.total;

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
    >
      <View style={styles.header}>
        <Text style={styles.hello}>NRYN Finance</Text>
        {status?.needsReview > 0 && (
          <TouchableOpacity onPress={() => router.push('/transactions?needsReview=true')} style={styles.reviewPill}>
            <Text style={styles.reviewText}>{status.needsReview} to review</Text>
          </TouchableOpacity>
        )}
      </View>

      <MonthSwitcher months={months} value={month} onChange={(m) => { setMonth(m); load(m); }} />

      <View style={styles.ringCard}>
        {noBudget ? (
          // Empty states are real screens — you hit this one on day one.
          <TouchableOpacity style={styles.emptyRing} onPress={() => router.push('/(tabs)/budgets')}>
            <Text style={styles.emptyBig}>Set your monthly budget</Text>
            <Text style={styles.emptySub}>Spent so far: ₹{((status?.ring?.spent || 0) / 100).toLocaleString('en-IN')}</Text>
          </TouchableOpacity>
        ) : (
          <BudgetRing total={ring.total} spent={ring.spent} remaining={ring.remaining} ratio={ring.ratio} over={ring.over} />
        )}
      </View>

      {status?.pace && <PaceBanner pace={status.pace} />}

      {status?.chips?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 18 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {status.chips.map((c: any) => (
            <CategoryChip key={c.category} chip={c} onPress={() => router.push(`/transactions?category=${c.category}&month=${month}`)} />
          ))}
        </ScrollView>
      )}

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Expenses</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {SORTS.map((s) => (
            <TouchableOpacity key={s.key} onPress={() => setSort(s.key)} style={[styles.sortPill, sort === s.key && styles.sortActive]}>
              <Text style={[styles.sortText, sort === s.key && { color: '#0B0F0D' }]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {txns.length === 0 ? (
        <View style={styles.emptyList}>
          <Text style={styles.emptyListText}>No expenses in {status?.period?.label}.</Text>
          <Text style={styles.emptyListSub}>Pull down to sync your SMS inbox, or tap + to add one.</Text>
        </View>
      ) : (
        txns.map((t) => <ExpenseRow key={t._id} txn={t} onPress={() => router.push(`/transaction/${t._id}`)} />)
      )}

      {txns.length >= 30 && (
        <TouchableOpacity onPress={() => router.push(`/transactions?month=${month}`)}>
          <Text style={styles.seeAll}>See all transactions →</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  hello: { color: theme.text, fontSize: 20, fontWeight: '800' },
  reviewPill: { backgroundColor: 'rgba(255,179,0,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  reviewText: { color: theme.warn, fontSize: 12, fontWeight: '600' },
  ringCard: { backgroundColor: theme.card, margin: 16, marginTop: 10, borderRadius: 24, paddingVertical: 24, alignItems: 'center' },
  emptyRing: { alignItems: 'center', paddingVertical: 36 },
  emptyBig: { color: theme.text, fontSize: 17, fontWeight: '700' },
  emptySub: { color: theme.textDim, marginTop: 6, fontSize: 13 },
  listHeader: { paddingHorizontal: 16, marginTop: 26, marginBottom: 6, gap: 10 },
  listTitle: { color: theme.text, fontSize: 17, fontWeight: '700' },
  sortPill: { backgroundColor: theme.cardAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  sortActive: { backgroundColor: theme.accent },
  sortText: { color: theme.textDim, fontSize: 12, fontWeight: '600' },
  emptyList: { padding: 32, alignItems: 'center' },
  emptyListText: { color: theme.text, fontSize: 14, fontWeight: '600' },
  emptyListSub: { color: theme.textDim, fontSize: 12, marginTop: 6, textAlign: 'center' },
  seeAll: { color: theme.accent, textAlign: 'center', padding: 18, fontWeight: '600' },
});
