import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react-native';
import { useTheme, makeStyles, Theme } from '../../theme';
import { haptic } from '../../utils/haptics';

interface AnomalyProps {
  anomalies: any[];
}

export default function AnomalyAlertBanner({ anomalies }: AnomalyProps) {
  const theme = useTheme();
  const styles = useStyles();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !anomalies || anomalies.length === 0) return null;

  const top = anomalies[0];
  const isDoubleDebit = top.type === 'double_debit';

  const handleDismiss = () => {
    haptic.light();
    setDismissed(true);
  };

  return (
    <View style={[styles.banner, isDoubleDebit ? styles.bannerHigh : styles.bannerWarn]}>
      <View style={styles.topRow}>
        <View style={styles.left}>
          {isDoubleDebit ? (
            <ShieldAlert size={18} color={theme.danger} />
          ) : (
            <AlertTriangle size={18} color={theme.warn} />
          )}
          <Text style={styles.title}>{top.title}</Text>
        </View>
        <TouchableOpacity
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtn}
        >
          <X size={16} color={theme.textDim} />
        </TouchableOpacity>
      </View>

      <Text style={styles.desc}>{top.description}</Text>

      {top.suggestedAction && (
        <View style={styles.actionBox}>
          <Text style={styles.actionText}>{top.suggestedAction}</Text>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    banner: {
      borderRadius: t.radius.md,
      marginHorizontal: 16,
      marginTop: 10,
      padding: 12,
      borderWidth: 1,
      ...t.shadows.sm,
    },
    bannerWarn: {
      backgroundColor: t.warnLight,
      borderColor: t.warnBorder,
    },
    bannerHigh: {
      backgroundColor: t.dangerLight,
      borderColor: t.dangerBorder,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    title: {
      color: t.text,
      fontSize: 14,
      fontWeight: '800',
    },
    closeBtn: {
      padding: 2,
    },
    desc: {
      color: t.text,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },
    actionBox: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: 'rgba(0, 0, 0, 0.06)',
    },
    actionText: {
      color: t.textDim,
      fontSize: 11,
      fontWeight: '600',
    },
  })
);
