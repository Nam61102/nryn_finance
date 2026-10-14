import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../services/api';
import { useTheme, makeStyles, Theme } from '../../theme';
import { formatINR } from '../../utils/format';
import PressableScale from '../../components/ui/PressableScale';
import { CategoriesSkeleton } from '../../components/skeletons';

export default function Categories() {
  const theme = useTheme();
  const styles = useStyles();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      api.get<any>('/analytics/by-category')
        .then((res) => setData(res))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  if (loading && !data) return <CategoriesSkeleton />;

  const total = data?.categories?.reduce((s: number, c: any) => s + (c.spent || 0), 0) || 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Categories</Text>
      <Text style={styles.sub}>
        {data?.period?.label || 'This month'} · {formatINR(total)} spent
      </Text>

      {(!data?.categories || data.categories.length === 0) && (
        <Text style={styles.empty}>Nothing recorded this month yet.</Text>
      )}

      {data?.categories?.map((c: any) => (
        <PressableScale
          key={c?.category || Math.random().toString()}
          style={styles.row}
          onPress={() => router.push(`/transactions?category=${c.category}&month=${data?.period?.month}`)}
          hapticType="light"
        >
          <View style={[styles.icon, { backgroundColor: `${c.color || theme.accent}22` }]}>
            <Text style={{ fontSize: 20 }}>{c.icon || '📦'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{c.label}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${total ? (c.spent / total) * 100 : 0}%`, backgroundColor: c.color || theme.accent },
                ]}
              />
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amount}>{formatINR(c.spent)}</Text>
            <Text style={styles.count}>{c.count} txn</Text>
          </View>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, paddingTop: 52, paddingBottom: 40 },
    h1: { color: t.text, fontSize: 24, fontWeight: '800' },
    sub: { color: t.textDim, fontSize: 13, marginTop: 4, marginBottom: 18 },
    empty: { color: t.textDim, textAlign: 'center', marginTop: 40 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: t.card,
      borderRadius: t.radius.md,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: t.border,
      ...t.shadows.sm,
    },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { color: t.text, fontSize: 14, fontWeight: '700', marginBottom: 6 },
    barTrack: {
      height: 5,
      backgroundColor: t.cardAlt,
      borderRadius: 3,
      overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: 3 },
    amount: { color: t.text, fontSize: 15, fontWeight: '800' },
    count: { color: t.textDim, fontSize: 11, marginTop: 2 },
  })
);
