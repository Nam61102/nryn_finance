import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Skeleton from '../ui/Skeleton';
import { useTheme } from '../../theme';

export default function HomeSkeleton() {
  const theme = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header skeleton */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Skeleton width={42} height={42} borderRadius={21} />
          <View style={{ gap: 6 }}>
            <Skeleton width={100} height={14} />
            <Skeleton width={140} height={18} />
          </View>
        </View>
        <Skeleton width={36} height={36} borderRadius={18} />
      </View>

      {/* Hero card skeleton */}
      <View style={styles.heroWrap}>
        <Skeleton width="100%" height={180} borderRadius={theme.radius.xl} />
      </View>

      {/* Month switcher & comparison skeleton */}
      <View style={styles.sectionWrap}>
        <View style={styles.chipsRow}>
          <Skeleton width={70} height={32} borderRadius={999} />
          <Skeleton width={70} height={32} borderRadius={999} />
          <Skeleton width={70} height={32} borderRadius={999} />
        </View>
        <Skeleton width="100%" height={110} borderRadius={theme.radius.lg} style={{ marginTop: 10 }} />
      </View>

      {/* Category chips skeleton */}
      <View style={styles.chipsRow}>
        <Skeleton width={96} height={110} borderRadius={theme.radius.md} />
        <Skeleton width={96} height={110} borderRadius={theme.radius.md} />
        <Skeleton width={96} height={110} borderRadius={theme.radius.md} />
      </View>

      {/* Cards skeleton */}
      <View style={styles.sectionWrap}>
        <Skeleton width="100%" height={140} borderRadius={theme.radius.lg} />
      </View>

      {/* Expense rows skeleton */}
      <View style={{ gap: 8, marginTop: 12 }}>
        <Skeleton width="100%" height={64} borderRadius={theme.radius.md} />
        <Skeleton width="100%" height={64} borderRadius={theme.radius.md} />
        <Skeleton width="100%" height={64} borderRadius={theme.radius.md} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroWrap: {
    marginBottom: 16,
  },
  sectionWrap: {
    marginBottom: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
});
