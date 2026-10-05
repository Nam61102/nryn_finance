import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../services/api';
import { syncSms } from '../../sync/sms.sync';
import { theme } from '../../theme';
import MonthSwitcher from '../../components/MonthSwitcher';
import CategoryChip from '../../components/CategoryChip';
import ExpenseRow from '../../components/ExpenseRow';
import PaceBanner from '../../components/PaceBanner';
import ExpensesCircularGraph from '../../components/ExpensesCircularGraph';
import SafeSpendGauge from '../../components/copilot/SafeSpendGauge';
import AnomalyAlertBanner from '../../components/copilot/AnomalyAlertBanner';
import SubscriptionCard from '../../components/copilot/SubscriptionCard';
import CopilotDrawer from '../../components/copilot/CopilotDrawer';
import AiRecommendationsCard from '../../components/copilot/AiRecommendationsCard';



export default function Home() {
  const [months, setMonths] = useState<any[]>([]);
  const [month, setMonth] = useState<string>('');
  const [status, setStatus] = useState<any>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [sort, setSort] = useState('date_desc');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Copilot Live State
  const [safeSpend, setSafeSpend] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [subs, setSubs] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any>(null);

  const load = useCallback(async (m?: string) => {
    try {
      const [mo, st, tx, ss, an, sb, rec] = await Promise.all([
        api.months(),
        api.budgetStatus(m),
        api.transactions({ month: m, sort, limit: '30' }),
        api.getSafeSpend(m).catch(() => null),
        api.getAnomalies().catch(() => ({ anomalies: [] })),
        api.getSubscriptions().catch(() => null),
        api.getRecommendations(m).catch(() => null),
      ]);
      setMonths(mo.months);
      setStatus(st);
      setMonth(st.period.month);
      setTxns(tx.transactions);
      if (ss?.ok) setSafeSpend(ss);
      if (an?.anomalies) setAnomalies(an.anomalies);
      if (sb?.ok) setSubs(sb);
      if (rec?.ok) setRecommendations(rec);
    } finally {
      setLoading(false);
    }
  }, [sort]);

  const handleSelectSort = (newSort: string) => {
    setSort(newSort);
    // Instant in-memory sort feedback
    setTxns((prev) => {
      const copy = [...prev];
      if (newSort === 'amount_desc') return copy.sort((a, b) => b.amount - a.amount);
      if (newSort === 'amount_asc') return copy.sort((a, b) => a.amount - b.amount);
      if (newSort === 'date_desc') return copy.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      if (newSort === 'date_asc') return copy.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
      return copy;
    });
  };

  useEffect(() => { load(month || undefined); }, [sort]);

  // Sync on open is the GUARANTEED trigger — background fetch is a bonus.
  useFocusEffect(useCallback(() => { syncSms().finally(() => load(month || undefined)); }, [month]));

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const p = await syncSms(); // pull-to-refresh does a REAL SMS sync
      if (p.phase === 'error') {
        Alert.alert('Sync issue', p.error || 'Failed to read SMS');
      } else if (p.uploaded > 0) {
        Alert.alert('Sync Complete', `Synced ${p.uploaded} new transaction(s)!`);
      }
    } catch (e: any) {
      Alert.alert('Sync error', e?.message || 'Failed to sync');
    }
    await load(month || undefined);
    setRefreshing(false);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>;
  }

  const ring = status?.ring;
  const noBudget = !ring?.total;
  const comparison = status?.comparison;
  const currentSpentRupees = ((status?.ring?.spent || 0) / 100).toLocaleString('en-IN');
  const lastMonthSpentRupees = ((comparison?.lastMonthSpent || 0) / 100).toLocaleString('en-IN');

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 80 }}
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

        <AnomalyAlertBanner anomalies={anomalies} />

        <MonthSwitcher months={months} value={month} onChange={(m) => { setMonth(m); load(m); }} />

        <SafeSpendGauge data={safeSpend} />

        <View style={styles.spendCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardHeaderTitle}>Monthly Spending Overview</Text>
          <Text style={styles.cardHeaderBadge}>{status?.period?.shortLabel || 'Current'}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>This Month ({status?.period?.shortLabel || 'Current'})</Text>
            <Text style={styles.statValueThis}>₹{currentSpentRupees}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Last Month ({comparison?.prevLabel || 'Previous'})</Text>
            <Text style={styles.statValuePrev}>₹{lastMonthSpentRupees}</Text>
          </View>
        </View>

        {comparison && (
          <View
            style={[
              styles.insightBadge,
              comparison.isSaved && styles.insightSaved,
              comparison.isMore && styles.insightMore,
            ]}
          >
            <Text style={styles.insightIcon}>
              {comparison.isSaved ? '📉' : comparison.isMore ? '📈' : '📊'}
            </Text>
            <Text
              style={[
                styles.insightText,
                comparison.isSaved && styles.textSaved,
                comparison.isMore && styles.textMore,
              ]}
            >
              {comparison.comparisonText}
            </Text>
          </View>
        )}

        {noBudget ? (
          <TouchableOpacity style={styles.budgetRow} onPress={() => router.push('/(tabs)/budgets')}>
            <Text style={styles.budgetPromptText}>🎯 Set monthly budget to track pace →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.budgetProgressWrap} onPress={() => router.push('/(tabs)/budgets')}>
            <View style={styles.budgetProgressHeader}>
              <Text style={styles.budgetProgressLabel}>
                Monthly Budget: ₹{((ring.total || 0) / 100).toLocaleString('en-IN')}
              </Text>
              <Text style={[styles.budgetProgressStatus, ring.over && { color: theme.danger }]}>
                {ring.over
                  ? `Over by ₹${(((ring.spent || 0) - (ring.total || 0)) / 100).toLocaleString('en-IN')}`
                  : `₹${(((ring.remaining || 0)) / 100).toLocaleString('en-IN')} left`}
              </Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min((ring.ratio || 0) * 100, 100)}%` },
                  ring.over && { backgroundColor: theme.danger },
                ]}
              />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {status?.pace && !noBudget && <PaceBanner pace={status.pace} />}

      {status?.chips?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 18 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {status.chips.map((c: any) => (
            <CategoryChip key={c.category} chip={c} onPress={() => router.push(`/transactions?category=${c.category}&month=${month}`)} />
          ))}
        </ScrollView>
      )}

      <View style={{ marginHorizontal: 16, marginTop: 16 }}>
        <AiRecommendationsCard data={recommendations} />
      </View>

      <ExpensesCircularGraph
        currentSort={sort}
        onSelectSort={handleSelectSort}
        txns={txns}
        totalCount={txns.length}
      />

      <SubscriptionCard data={subs} />

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Expense Transactions</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{txns.length} items</Text>
        </View>
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

    {/* Floating Autonomous AI Copilot Drawer */}
    <CopilotDrawer />
  </View>
);
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  hello: { color: theme.text, fontSize: 20, fontWeight: '800' },
  reviewPill: {
    backgroundColor: '#FFF7ED',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  reviewText: { color: theme.accent, fontSize: 12, fontWeight: '700' },
  spendCard: {
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeaderTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardHeaderBadge: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  statCol: {
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: theme.border,
    marginHorizontal: 12,
  },
  statLabel: {
    color: theme.textDim,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  statValueThis: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '800',
  },
  statValuePrev: {
    color: theme.textDim,
    fontSize: 18,
    fontWeight: '700',
  },
  insightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 2,
    marginBottom: 10,
    gap: 8,
  },
  insightSaved: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  insightMore: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  insightIcon: {
    fontSize: 16,
  },
  insightText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  textSaved: {
    color: '#059669',
  },
  textMore: {
    color: theme.accent,
  },
  budgetRow: {
    marginTop: 4,
    paddingTop: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  budgetPromptText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  budgetProgressWrap: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  budgetProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  budgetProgressLabel: {
    color: theme.textDim,
    fontSize: 12,
    fontWeight: '500',
  },
  budgetProgressStatus: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.accent,
    borderRadius: 999,
  },
  listHeader: {
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listTitle: { color: theme.text, fontSize: 16, fontWeight: '700' },
  countBadge: {
    backgroundColor: theme.cardAlt,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: theme.border,
  },
  countBadgeText: { color: theme.textDim, fontSize: 12, fontWeight: '600' },
  emptyList: { padding: 32, alignItems: 'center' },
  emptyListText: { color: theme.text, fontSize: 14, fontWeight: '600' },
  emptyListSub: { color: theme.textDim, fontSize: 12, marginTop: 6, textAlign: 'center' },
  seeAll: { color: theme.accent, textAlign: 'center', padding: 18, fontWeight: '600' },
});
