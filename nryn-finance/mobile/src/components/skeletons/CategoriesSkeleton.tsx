import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Skeleton from '../ui/Skeleton';
import { useTheme } from '../../theme';

export default function CategoriesSkeleton() {
  const theme = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Skeleton width={180} height={28} style={{ marginBottom: 6 }} />
      <Skeleton width={140} height={16} style={{ marginBottom: 20 }} />

      <View style={{ gap: 10 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
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
