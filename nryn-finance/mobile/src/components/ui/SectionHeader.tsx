import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { haptic } from '../../utils/haptics';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  badge?: string | number;
  style?: StyleProp<ViewStyle>;
}

export default function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  badge,
  style,
}: SectionHeaderProps) {
  const theme = useTheme();

  const handleAction = () => {
    haptic.light();
    onAction?.();
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {badge != null && (
            <View style={[styles.badge, { backgroundColor: theme.cardAlt, borderColor: theme.border }]}>
              <Text style={[styles.badgeText, { color: theme.textDim }]}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && <Text style={[styles.subtitle, { color: theme.textDim }]}>{subtitle}</Text>}
      </View>

      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={handleAction}
          activeOpacity={0.7}
          style={styles.actionBtn}
        >
          <Text style={[styles.actionText, { color: theme.accent }]}>{actionLabel}</Text>
          <ChevronRight size={14} color={theme.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  left: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
