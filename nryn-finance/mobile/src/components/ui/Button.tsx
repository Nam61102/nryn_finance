import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme';
import PressableScale from './PressableScale';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const theme = useTheme();

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: theme.radius.sm },
    md: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: theme.radius.md },
    lg: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: theme.radius.lg },
  }[size];

  const fontSize = size === 'sm' ? 12 : size === 'md' ? 14 : 16;

  const variantStyles = {
    primary: {
      backgroundColor: theme.accent,
      borderWidth: 0,
      textColor: '#FFFFFF',
      ...theme.shadows.md,
    },
    secondary: {
      backgroundColor: theme.cardAlt,
      borderWidth: 1,
      borderColor: theme.border,
      textColor: theme.text,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.border,
      textColor: theme.text,
    },
    danger: {
      backgroundColor: theme.dangerLight,
      borderWidth: 1,
      borderColor: theme.dangerBorder,
      textColor: theme.danger,
    },
  }[variant];

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      hapticType={variant === 'primary' ? 'medium' : 'light'}
      style={[
        styles.base,
        sizeStyles,
        {
          backgroundColor: variantStyles.backgroundColor,
          borderWidth: variantStyles.borderWidth,
          borderColor: variantStyles.borderColor,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : theme.accent}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text
            style={[
              styles.text,
              { color: variantStyles.textColor, fontSize },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconWrap: {
    marginRight: 2,
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
  },
});
