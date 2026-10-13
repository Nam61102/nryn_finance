import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useTheme, makeStyles, Theme } from '../theme';
import { formatINR, formatRelativeIST } from '../utils/format';
import { PressableScale } from './ui';

export default function ExpenseRow({ txn, onPress }: { txn: any; onPress?: () => void }) {
  const theme = useTheme();
  const styles = useStyles();

  const when = formatRelativeIST(txn.occurredAt);
  const isCredit = txn.direction === 'credit';

  return (
    <PressableScale
      onPress={onPress}
      hapticType="light"
      style={styles.container}
    >
      {/* Merchant / Category Icon in Tinted Container */}
      <View style={styles.iconWrap}>
        <Text style={styles.iconText}>{txn.merchantIcon || '📦'}</Text>
      </View>

      {/* Main Info */}
      <View style={styles.infoCol}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {txn.merchantName || txn.merchantRaw || 'Unknown'}
          </Text>
          {txn.needsReview && <View style={styles.dotReview} />}
          {txn.source === 'manual' && <Text style={styles.tag}>manual</Text>}
        </View>
        <Text style={styles.subtext}>
          {txn.category ? `${txn.category.replace('_', ' ')} · ` : ''}{when}
        </Text>
      </View>

      {/* Amount Right-Aligned */}
      <Text
        style={[
          styles.amount,
          { color: isCredit ? theme.success : theme.text },
        ]}
      >
        {isCredit ? '+' : ''}{formatINR(txn.amount)}
      </Text>
    </PressableScale>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: t.card,
      marginHorizontal: 16,
      marginVertical: 4,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.border,
      ...t.shadows.sm,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: t.accentLight,
      borderWidth: 1,
      borderColor: t.accentBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconText: {
      fontSize: 20,
    },
    infoCol: {
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    name: {
      color: t.text,
      fontSize: 15,
      fontWeight: '700',
      flexShrink: 1,
    },
    subtext: {
      color: t.textDim,
      fontSize: 12,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    amount: {
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    dotReview: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.warn,
    },
    tag: {
      color: t.textDim,
      fontSize: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 5,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
  })
);
