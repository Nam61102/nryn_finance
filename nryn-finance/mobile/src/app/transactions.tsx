import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Receipt } from 'lucide-react-native';
import { api } from '../services/api';
import { syncSms } from '../sync/sms.sync';
import { useTheme, makeStyles } from '../theme';
import { triggerHaptic } from '../utils/haptics';
import ExpenseRow from '../components/ExpenseRow';
import PressableScale from '../components/ui/PressableScale';
import EmptyState from '../components/ui/EmptyState';
import TransactionsSkeleton from '../components/skeletons/TransactionsSkeleton';

export default function Transactions() {
  const theme = useTheme();
  const styles = useStyles();
  const params = useLocalSearchParams<{ month?: string; category?: string; needsReview?: string }>();
  const [rows, setRows] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (next?: string) => {
    try {
      const res = await api.transactions({
        month: params.month,
        category: params.category,
        needsReview: params.needsReview,
        includeNonExpense: params.needsReview ? 'true' : undefined,
        cursor: next,
        limit: '40',
      });
      setRows((prev) => (next ? [...prev, ...res.transactions] : res.transactions));
      setCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [params.month, params.category, params.needsReview]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const title = params.needsReview
    ? 'Needs review'
    : params.category
    ? params.category.replace('_', ' ')
    : 'All transactions';

  const goBack = () => {
    triggerHaptic('light');
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const handleRefresh = async () => {
    triggerHaptic('medium');
    setRefreshing(true);
    await syncSms();
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <PressableScale onPress={goBack} style={styles.backBtn}>
          <ArrowLeft size={20} color={theme.colors.accent} />
          <Text style={styles.backText}>Back</Text>
        </PressableScale>
        <Text style={styles.h1}>{title}</Text>
      </View>

      {loading && rows.length === 0 ? (
        <TransactionsSkeleton />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(t) => t._id}
          renderItem={({ item }) => (
            <ExpenseRow
              txn={item}
              onPress={() => router.push(`/transaction/${item._id}`)}
            />
          )}
          onEndReached={() => cursor && load(cursor)}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={theme.colors.accent}
              onRefresh={handleRefresh}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Receipt size={28} color={theme.colors.accent} />}
              title="No transactions found"
              subtitle={
                params.needsReview
                  ? 'All recent bank SMS messages were parsed with high confidence.'
                  : 'No expenses recorded for this period yet.'
              }
              actionTitle="Add Expense"
              onAction={() => router.push('/add')}
            />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.bg,
    },
    topBar: {
      paddingHorizontal: 16,
      paddingTop: 44,
      paddingBottom: 8,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
      alignSelf: 'flex-start',
    },
    backText: {
      color: t.colors.accent,
      fontSize: 15,
      fontWeight: '600',
    },
    h1: {
      color: t.colors.text,
      fontSize: 24,
      fontWeight: '800',
      textTransform: 'capitalize',
      letterSpacing: -0.5,
    },
  })
);
