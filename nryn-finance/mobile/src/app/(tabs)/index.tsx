import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Inbox } from 'lucide-react-native';
import { api } from '../../services/api';
import { syncSms } from '../../sync/sms.sync';
import { useTheme, makeStyles, Theme } from '../../theme';
import CategoryChip from '../../components/CategoryChip';
import ExpenseRow from '../../components/ExpenseRow';
import PaceBanner from '../../components/PaceBanner';
import ExpensesCircularGraph from '../../components/ExpensesCircularGraph';
import AnomalyAlertBanner from '../../components/copilot/AnomalyAlertBanner';
import SubscriptionCard from '../../components/copilot/SubscriptionCard';
import CopilotDrawer from '../../components/copilot/CopilotDrawer';
import AiRecommendationsCard from '../../components/copilot/AiRecommendationsCard';
import HomeHeader from '../../components/home/HomeHeader';
import HomeHeroCard from '../../components/home/HomeHeroCard';
import MonthComparisonRow from '../../components/home/MonthComparisonRow';
import SectionHeader from '../../components/ui/SectionHeader';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBoundary from '../../components/ui/ErrorBoundary';
import { HomeSkeleton } from '../../components/skeletons';
import { haptic } from '../../utils/haptics';

export default function Home() {
  const theme = useTheme();
  const styles = useStyles();

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

  const initialSyncTimer = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(
    async (m?: string) => {
      try {
        const [mo, st, tx, ss, an, sb, rec] = await Promise.all([
          api.months().catch(() => ({ months: [] })),
          api.budgetStatus(m).catch(() => null),
          api.transactions({ month: m, sort, limit: '30' }).catch(() => ({ transactions: [] })),
          api.getSafeSpend(m).catch(() => null),
          api.getAnomalies().catch(() => ({ anomalies: [] })),
          api.getSubscriptions().catch(() => null),
          api.getRecommendations(m).catch(() => null),
        ]);
        if (mo?.months && Array.isArray(mo.months)) setMonths(mo.months);
        if (st) {
          setStatus(st);
          if (st.period?.month && !m) setMonth(st.period.month);
        }
        if (tx?.transactions && Array.isArray(tx.transactions)) setTxns(tx.transactions);
        if (ss?.ok) setSafeSpend(ss);
        if (an?.anomalies && Array.isArray(an.anomalies)) setAnomalies(an.anomalies);
        if (sb?.ok) setSubs(sb);
        if (rec?.ok) setRecommendations(rec);
      } catch (e: any) {
        console.warn('Dashboard load error:', e);
      } finally {
        setLoading(false);
      }
    },
    [sort]
  );

  const handleSelectSort = (newSort: string) => {
    setSort(newSort);
    // Instant in-memory sort feedback
    setTxns((prev) => {
      if (!Array.isArray(prev)) return [];
      const copy = [...prev];
      if (newSort === 'amount_desc') return copy.sort((a, b) => (b?.amount || 0) - (a?.amount || 0));
      if (newSort === 'amount_asc') return copy.sort((a, b) => (a?.amount || 0) - (b?.amount || 0));
      if (newSort === 'date_desc')
        return copy.sort(
          (a, b) => new Date(b?.occurredAt || 0).getTime() - new Date(a?.occurredAt || 0).getTime()
        );
      if (newSort === 'date_asc')
        return copy.sort(
          (a, b) => new Date(a?.occurredAt || 0).getTime() - new Date(b?.occurredAt || 0).getTime()
        );
      return copy;
    });
  };

  useEffect(() => {
    load(month || undefined);
  }, [sort, load]);

  // Gentle focus refresh — reads latest database state without querying native telephony
  useFocusEffect(
    useCallback(() => {
      load(month || undefined);
    }, [month, load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    haptic.light();
    try {
      await load(month || undefined);
      const p = await syncSms().catch(() => null);
      if (p && p.uploaded > 0) {
        haptic.success();
        Alert.alert('Sync Complete', `Synced ${p.uploaded} new transaction(s)!`);
        await load(month || undefined);
      }
    } catch (e: any) {
      console.warn('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <HomeSkeleton />;
  }

  const ring = status?.ring;
  const noBudget = !ring?.total || ring.total <= 0;
  const safeTxns = Array.isArray(txns) ? txns : [];
  const recentTxns = safeTxns.slice(0, 5);

  return (
    <ErrorBoundary fallbackTitle="Dashboard" onReset={() => load(month || undefined)}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
        >
          {/* 1. Header (Greeting, Avatar, Review Count) */}
          <HomeHeader
            userName="there"
            needsReviewCount={status?.needsReview || 0}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />

          {/* 2. HERO CARD (Focal visual anchor) */}
          <HomeHeroCard safeSpend={safeSpend} />

          {/* 3. Anomaly Alert Banner (Dismissible, only if anomalies exist) */}
          <AnomalyAlertBanner anomalies={anomalies} />

          {/* 4. Month Switcher + This vs Last Month Stats */}
          <MonthComparisonRow
            months={months}
            month={month}
            onSelectMonth={(m) => {
              setMonth(m);
              load(m);
            }}
            status={status}
          />

          {/* 5. Pace Banner (if budget exists) */}
          {status?.pace && !noBudget && <PaceBanner pace={status.pace} />}

          {/* 6. Category Chips (Horizontal Scroll) */}
          {status?.chips?.length > 0 && (
            <View style={styles.chipsSection}>
              <SectionHeader title="Category Budgets" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {status.chips.map((c: any) => (
                  <CategoryChip
                    key={c.category || Math.random().toString()}
                    chip={c}
                    onPress={() => router.push(`/transactions?category=${c.category}&month=${month}`)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* 7. AI Insights Card (Recommendations: Top 1-2 items) */}
          <View style={styles.sectionWrap}>
            <AiRecommendationsCard data={recommendations} maxInitial={2} />
          </View>

          {/* 8. Expenses Circular Donut Graph (4 sort slices with sweep-in) */}
          <ExpensesCircularGraph
            currentSort={sort}
            onSelectSort={handleSelectSort}
            txns={safeTxns}
            totalCount={safeTxns.length}
          />

          {/* 9. Subscriptions Card */}
          <SubscriptionCard data={subs} />

          {/* 10. Recent Transactions */}
          <View style={styles.txnsSection}>
            <SectionHeader
              title="Recent Expenses"
              badge={safeTxns.length > 0 ? `${safeTxns.length} total` : undefined}
              actionLabel={safeTxns.length > 5 ? 'See all' : undefined}
              onAction={() => router.push(`/transactions?month=${month}`)}
            />

            {recentTxns.length === 0 ? (
              <View>
                <EmptyState
                  icon={<Inbox size={28} color={theme.accent} />}
                  title="No expenses recorded yet"
                  subtitle={`No transactions found in ${status?.period?.label || 'this period'}. Pull down to sync SMS, or load sample bank data.`}
                  actionTitle="SMS Setup / Load Sample Data"
                  onAction={() => router.push('/onboarding')}
                />
                <TouchableOpacity
                  onPress={() => router.push('/add')}
                  style={{ alignSelf: 'center', marginTop: -8, marginBottom: 16, padding: 8 }}
                >
                  <Text style={{ color: theme.textDim, fontSize: 13, fontWeight: '500' }}>
                    or + Add expense manually
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              recentTxns.map((t) => (
                <ExpenseRow
                  key={t?._id || Math.random().toString()}
                  txn={t}
                  onPress={() => router.push(`/transaction/${t._id}`)}
                />
              ))
            )}
          </View>
        </ScrollView>

        {/* Floating Autonomous AI Copilot Drawer */}
        <CopilotDrawer />
      </View>
    </ErrorBoundary>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 96,
    },
    chipsSection: {
      marginTop: 8,
      marginBottom: 12,
    },
    chipsScroll: {
      paddingHorizontal: 16,
    },
    sectionWrap: {
      marginHorizontal: 16,
      marginTop: 10,
    },
    txnsSection: {
      marginTop: 20,
    },
  })
);
