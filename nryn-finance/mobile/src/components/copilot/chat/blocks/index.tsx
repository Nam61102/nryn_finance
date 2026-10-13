import React from 'react';
import { View, StyleSheet } from 'react-native';
import StatBlock from './StatBlock';
import ProgressBlock from './ProgressBlock';
import BarBlock from './BarBlock';
import TransactionsBlock from './TransactionsBlock';
import SubscriptionsBlock from './SubscriptionsBlock';
import VerdictBlock from './VerdictBlock';
import ActionsBlock from './ActionsBlock';

export {
  StatBlock,
  ProgressBlock,
  BarBlock,
  TransactionsBlock,
  SubscriptionsBlock,
  VerdictBlock,
  ActionsBlock,
};

interface BlockRendererProps {
  blocks: any[];
  onCloseSheet?: () => void;
}

export default function BlockRenderer({ blocks, onCloseSheet }: BlockRendererProps) {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return null;

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        if (!block || !block.type) return null;
        switch (block.type) {
          case 'stat':
            return <StatBlock key={idx} block={block} />;
          case 'progress':
            return <ProgressBlock key={idx} block={block} />;
          case 'bar':
            return <BarBlock key={idx} block={block} />;
          case 'transactions':
            return <TransactionsBlock key={idx} block={block} />;
          case 'subscriptions':
            return <SubscriptionsBlock key={idx} block={block} />;
          case 'verdict':
            return <VerdictBlock key={idx} block={block} />;
          case 'actions':
            return <ActionsBlock key={idx} block={block} onCloseSheet={onCloseSheet} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    marginTop: 8,
    width: '100%',
  },
});
