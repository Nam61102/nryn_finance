import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../../../theme';
import PressableScale from '../../../ui/PressableScale';

interface TransactionsBlockProps {
  block: {
    type: 'transactions';
    title: string;
    items: Array<{
      id: string;
      merchant: string;
      amount: string;
      category: string;
      date: string;
    }>;
  };
}

export default function TransactionsBlock({ block }: TransactionsBlockProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.cardAlt, borderColor: theme.colors.border }]}>
      <Text style={[styles.title, { color: theme.colors.textDim }]}>{block.title}</Text>
      <View style={styles.list}>
        {block.items.map((item) => (
          <PressableScale
            key={item.id}
            onPress={() => router.push(`/transaction/${item.id}`)}
            style={[styles.row, { borderBottomColor: theme.colors.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.merchant, { color: theme.colors.text }]} numberOfLines={1}>
                {item.merchant}
              </Text>
              <Text style={[styles.date, { color: theme.colors.textDim }]}>
                {item.date} · {item.category}
              </Text>
            </View>
            <Text style={[styles.amount, { color: theme.colors.text }]}>{item.amount}</Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginVertical: 4,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  list: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  merchant: {
    fontSize: 13,
    fontWeight: '600',
  },
  date: {
    fontSize: 11,
    marginTop: 2,
  },
  amount: {
    fontSize: 13,
    fontWeight: '700',
  },
});
