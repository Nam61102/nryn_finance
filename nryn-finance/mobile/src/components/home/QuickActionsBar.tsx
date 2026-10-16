import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Plus, RefreshCw, Target, BarChart2 } from 'lucide-react-native';
import { useTheme, makeStyles, Theme } from '../../theme';
import { haptic } from '../../utils/haptics';

interface QuickActionsBarProps {
  onSyncSms: () => void;
  syncing?: boolean;
}

export default function QuickActionsBar({ onSyncSms, syncing }: QuickActionsBarProps) {
  const styles = useStyles();

  return (
    <View style={styles.container}>
      {/* 1. Add Cash / Expense */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => {
          haptic.light();
          router.push('/add');
        }}
        activeOpacity={0.75}
      >
        <View style={styles.iconCirclePrimary}>
          <Plus size={18} color="#FFFFFF" />
        </View>
        <Text style={styles.actionLabel}>Add Cash</Text>
      </TouchableOpacity>

      {/* 2. Scan / Sync SMS */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => {
          haptic.light();
          onSyncSms();
        }}
        activeOpacity={0.75}
        disabled={syncing}
      >
        <View style={styles.iconCircleSecondary}>
          <RefreshCw size={17} color="#FF6D00" />
        </View>
        <Text style={styles.actionLabel}>{syncing ? 'Syncing...' : 'Scan SMS'}</Text>
      </TouchableOpacity>

      {/* 3. Budgets */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => {
          haptic.light();
          router.push('/(tabs)/budgets');
        }}
        activeOpacity={0.75}
      >
        <View style={styles.iconCircleSecondary}>
          <Target size={17} color="#FF6D00" />
        </View>
        <Text style={styles.actionLabel}>Budgets</Text>
      </TouchableOpacity>

      {/* 4. Categories */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => {
          haptic.light();
          router.push('/(tabs)/categories');
        }}
        activeOpacity={0.75}
      >
        <View style={styles.iconCircleSecondary}>
          <BarChart2 size={17} color="#FF6D00" />
        </View>
        <Text style={styles.actionLabel}>Categories</Text>
      </TouchableOpacity>
    </View>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#F1F5F9',
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    actionBtn: {
      alignItems: 'center',
      flex: 1,
      gap: 6,
    },
    iconCirclePrimary: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#FF6D00',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#FF6D00',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
    },
    iconCircleSecondary: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#FFF7ED',
      borderWidth: 1.5,
      borderColor: '#FFD7B2',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: '#431407',
      letterSpacing: 0.2,
    },
  })
);
