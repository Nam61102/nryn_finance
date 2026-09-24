import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, formatINR } from '../../services/api';
import { theme } from '../../theme';

export default function Categories() {
  const [data, setData] = useState<any>(null);

  useFocusEffect(useCallback(() => { api.get<any>('/analytics/by-category').then(setData); }, []));

  if (!data) return <View style={styles.center}><Text style={{ color: theme.textDim }}>Loading…</Text></View>;

  const total = data.categories.reduce((s: number, c: any) => s + c.spent, 0);

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 40 }}>
      <Text style={styles.h1}>Categories</Text>
      <Text style={styles.sub}>{data.period.label} · {formatINR(total)} spent</Text>

      {data.categories.length === 0 && <Text style={styles.empty}>Nothing recorded this month yet.</Text>}

      {data.categories.map((c: any) => (
        <TouchableOpacity
          key={c.category}
          style={styles.row}
          onPress={() => router.push(`/transactions?category=${c.category}&month=${data.period.month}`)}
        >
          <View style={[styles.icon, { backgroundColor: `${c.color}22` }]}><Text style={{ fontSize: 18 }}>{c.icon}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{c.label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${total ? (c.spent / total) * 100 : 0}%`, backgroundColor: c.color }]} />
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amount}>{formatINR(c.spent)}</Text>
            <Text style={styles.count}>{c.count} txn</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  h1: { color: theme.text, fontSize: 24, fontWeight: '800' },
  sub: { color: theme.textDim, fontSize: 13, marginTop: 6, marginBottom: 18 },
  empty: { color: theme.textDim, textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.card, borderRadius: 16, padding: 14, marginBottom: 10 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  barTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3 },
  amount: { color: theme.text, fontSize: 14, fontWeight: '700' },
  count: { color: theme.textDim, fontSize: 11, marginTop: 3 },
});
