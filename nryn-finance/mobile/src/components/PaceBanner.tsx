import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react-native';
import { makeStyles, Theme } from '../theme';

interface PaceProps {
  pace: {
    state: string;
    copy: string;
  };
}

export default function PaceBanner({ pace }: PaceProps) {
  const styles = useStyles();

  if (!pace?.copy) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Sparkles size={13} color="#FF6D00" />
          <Text style={styles.titleText}>AI SPENDING PACE</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ON PACE</Text>
        </View>
      </View>
      <View style={styles.bodyRow}>
        <View style={styles.iconWrap}>
          <CheckCircle2 size={16} color="#FF6D00" />
        </View>
        <Text style={styles.text}>{pace.copy}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: '#FFFFFF',
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 6,
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#F1F5F9',
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    titleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    titleText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#E65100',
      letterSpacing: 0.8,
    },
    badge: {
      backgroundColor: '#FFF7ED',
      borderWidth: 1,
      borderColor: '#FFD7B2',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#FF6D00',
      letterSpacing: 0.5,
    },
    bodyRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    iconWrap: {
      marginTop: 1,
    },
    text: {
      color: '#431407',
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
      lineHeight: 18,
    },
  })
);
