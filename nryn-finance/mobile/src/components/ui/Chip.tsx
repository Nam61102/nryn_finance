import React from 'react';
import { Text, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import PressableScale from './PressableScale';

interface ChipProps {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  badge?: string | number;
}

export default function Chip({
  label,
  icon,
  active = false,
  onPress,
  style,
  badge,
}: ChipProps) {
  const theme = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      hapticType="light"
      style={[
        styles.chip,
        {
          borderRadius: theme.radius.sm,
          backgroundColor: active ? theme.accentLight : theme.cardAlt,
          borderColor: active ? theme.accent : theme.border,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {icon && <View style={styles.iconWrap}>{icon}</View>}
        <Text
          style={[
            styles.label,
            { color: active ? theme.accent : theme.textDim },
            active && styles.labelActive,
          ]}
        >
          {label}
        </Text>
        {badge != null && (
          <View
            style={[
              styles.badgeWrap,
              { backgroundColor: active ? theme.accent : theme.border },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: active ? '#FFFFFF' : theme.text },
              ]}
            >
              {badge}
            </Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconWrap: {
    marginRight: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  labelActive: {
    fontWeight: '800',
  },
  badgeWrap: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
