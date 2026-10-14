import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Skeleton from '../ui/Skeleton';
import { useTheme } from '../../theme';

export default function BudgetsSkeleton() {
  const theme = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Skeleton width={160} height={28} style={{ marginBottom: 20 }} />

      {/* Ring / summary skeleton */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Skeleton width={200} height={200} borderRadius={100} />
      </View>

      {/* Total budget card skeleton */}
      <Skeleton width="100%" height={110} borderRadius={theme.radius.lg} style={{ marginBottom: 16 }} />

      {/* Category budgets skeleton */}
      <View style={{ gap: 10 }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width="100%" height={74} borderRadius={theme.radius.md} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 52, paddingBottom: 40 },
});
