import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { api } from '../services/api';
import { syncSms } from '../sync/sms.sync';
import { theme } from '../theme';
import ExpenseRow from '../components/ExpenseRow';

export default function Transactions() {
  const params = useLocalSearchParams<{ month?: string; category?: string; needsReview?: string }>();
  const [rows, setRows] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (next?: string) => {
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
  }, [params.month, params.category, params.needsReview]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const title = params.needsReview ? 'Needs review' : params.category ? params.category.replace('_', ' ') : 'All transactions';

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 40 }}>
        <TouchableOpacity onPress={goBack} style={{ marginBottom: 8 }}>
          <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '600' }}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.h1}>{title}</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(t) => t._id}
        renderItem={({ item }) => <ExpenseRow txn={item} onPress={() => router.push(`/transaction/${item._id}`)} />}
        onEndReached={() => cursor && load(cursor)}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.accent}
            onRefresh={async () => { setRefreshing(true); await syncSms(); await load(); setRefreshing(false); }}
          />
        }
        ListEmptyComponent={<Text style={styles.empty}>Nothing here.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { color: theme.text, fontSize: 22, fontWeight: '800', textTransform: 'capitalize', marginBottom: 12 },
  empty: { color: theme.textDim, textAlign: 'center', marginTop: 60 },
});
