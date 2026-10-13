import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { CheckCircle2, AlertCircle, AlertTriangle, XCircle, Info } from 'lucide-react-native';
import { useTheme, makeStyles, Theme } from '../theme';

interface PaceProps {
  pace: {
    state: string;
    copy: string;
  };
}

export default function PaceBanner({ pace }: PaceProps) {
  const theme = useTheme();
  const styles = useStyles();

  const getTone = () => {
    switch (pace.state) {
      case 'good':
        return {
          bg: theme.successLight,
          border: theme.successBorder,
          icon: <CheckCircle2 size={18} color={theme.success} />,
        };
      case 'on_track':
        return {
          bg: theme.warnLight,
          border: theme.warnBorder,
          icon: <Info size={18} color={theme.warn} />,
        };
      case 'ahead':
        return {
          bg: theme.accentLight,
          border: theme.accentBorder,
          icon: <AlertTriangle size={18} color={theme.accent} />,
        };
      case 'over':
        return {
          bg: theme.dangerLight,
          border: theme.dangerBorder,
          icon: <XCircle size={18} color={theme.danger} />,
        };
      default:
        return {
          bg: theme.cardAlt,
          border: theme.border,
          icon: <Info size={18} color={theme.textDim} />,
        };
    }
  };

  const tone = getTone();

  return (
    <View style={[styles.wrap, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      {tone.icon}
      <Text style={styles.text}>{pace.copy}</Text>
    </View>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 16,
      padding: 12,
      borderRadius: t.radius.md,
      borderWidth: 1,
    },
    text: {
      color: t.text,
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
      lineHeight: 18,
    },
  })
);
