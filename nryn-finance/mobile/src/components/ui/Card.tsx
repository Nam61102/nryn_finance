import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'alt' | 'elevated' | 'outlined';
}

export default function Card({ children, style, variant = 'default' }: CardProps) {
  const theme = useTheme();

  const variantStyle = {
    default: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderWidth: 1,
      ...theme.shadows.sm,
    },
    alt: {
      backgroundColor: theme.cardAlt,
      borderColor: theme.border,
      borderWidth: 1,
    },
    elevated: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderWidth: 1,
      ...theme.shadows.md,
    },
    outlined: {
      backgroundColor: 'transparent',
      borderColor: theme.border,
      borderWidth: 1,
    },
  }[variant];

  return (
    <View style={[styles.base, { borderRadius: theme.radius.lg }, variantStyle, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    padding: 16,
  },
});
