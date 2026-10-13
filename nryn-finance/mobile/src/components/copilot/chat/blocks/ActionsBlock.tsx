import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../../../theme';
import PressableScale from '../../../ui/PressableScale';

interface ActionsBlockProps {
  block: {
    type: 'actions';
    buttons: Array<{
      label: string;
      action: string;
      payload?: any;
    }>;
  };
  onCloseSheet?: () => void;
}

export default function ActionsBlock({ block, onCloseSheet }: ActionsBlockProps) {
  const theme = useTheme();

  const handleAction = (action: string) => {
    onCloseSheet?.();
    if (action === 'navigate_budgets') {
      router.push('/(tabs)/budgets');
    } else if (action === 'navigate_hub') {
      router.push('/add');
    } else if (action === 'select_regime') {
      router.push('/(tabs)/profile');
    } else if (action === 'open_loan_simulator') {
      router.push('/add');
    }
  };

  return (
    <View style={styles.container}>
      {block.buttons.map((btn, idx) => (
        <PressableScale
          key={idx}
          onPress={() => handleAction(btn.action)}
          style={[styles.btn, { backgroundColor: theme.colors.accent }]}
        >
          <Text style={styles.btnText}>{btn.label}</Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  btn: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: {
    color: '#0B0F0D',
    fontSize: 12,
    fontWeight: '700',
  },
});
