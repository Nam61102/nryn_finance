import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Skeleton } from '../ui';
import { useTheme } from '../../theme';

export default function TransactionsSkeleton() {
  const theme = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Skeleton width={180} height={28} style={{ marginBottom: 16 }} />
      <View style={styles.filterRow}>
        <Skeleton width={80} height={32} borderRadius={999} />
        <Skeleton width={80} height={32} borderRadius={999} />
        <Skeleton width={80} height={32} borderRadius={999} />
      </View>

      <View style={{ gap: 8, marginTop: 16 }}>
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} width="100%" height={68} borderRadius={theme.radius.md} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 52, paddingBottom: 40 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
});
