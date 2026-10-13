import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react-native';
import { useTheme } from '../../../../theme';

interface VerdictBlockProps {
  block: {
    type: 'verdict';
    status: 'approved' | 'caution' | 'warning' | 'info';
    title: string;
    message: string;
  };
}

export default function VerdictBlock({ block }: VerdictBlockProps) {
  const theme = useTheme();

  const config = {
    approved: {
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.1)',
      Icon: CheckCircle2,
    },
    caution: {
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.1)',
      Icon: AlertTriangle,
    },
    warning: {
      color: '#FF4757',
      bg: 'rgba(255, 71, 87, 0.1)',
      Icon: XCircle,
    },
    info: {
      color: theme.colors.accent,
      bg: theme.colors.accentLight,
      Icon: Info,
    },
  }[block.status] || {
    color: theme.colors.accent,
    bg: theme.colors.accentLight,
    Icon: Info,
  };

  const { color, bg, Icon } = config;

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: color }]}>
      <View style={styles.header}>
        <Icon size={18} color={color} />
        <Text style={[styles.title, { color }]}>{block.title}</Text>
      </View>
      <Text style={[styles.message, { color: theme.colors.text }]}>{block.message}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    fontSize: 12,
    lineHeight: 18,
  },
});
