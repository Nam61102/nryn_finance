import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Sparkles,
  FileText,
  Shield,
  Building,
  Banknote,
} from 'lucide-react-native';
import { useTheme, makeStyles } from '../theme';
import { triggerHaptic } from '../utils/haptics';
import PressableScale from '../components/ui/PressableScale';
import StatementScanner from '../components/add/StatementScanner';
import PolicyForm from '../components/add/PolicyForm';
import AccountForm from '../components/add/AccountForm';
import CashEntryForm from '../components/add/CashEntryForm';

type HubTab = 'statement' | 'insurance' | 'account' | 'cash';

export default function FinancialHubAdd() {
  const theme = useTheme();
  const styles = useStyles();
  const [activeTab, setActiveTab] = useState<HubTab>('statement');

  const goBack = () => {
    triggerHaptic('light');
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const handleTabChange = (tab: HubTab) => {
    triggerHaptic('selection');
    setActiveTab(tab);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      {/* Top Header */}
      <View style={styles.topHeader}>
        <PressableScale onPress={goBack} style={styles.backBtn}>
          <ArrowLeft size={18} color={theme.colors.accent} />
          <Text style={styles.backText}>Back</Text>
        </PressableScale>
        <View style={styles.aiBadge}>
          <Sparkles size={13} color={theme.colors.accent} />
          <Text style={styles.aiBadgeText}>AI Hub Active</Text>
        </View>
      </View>

      <Text style={styles.h1}>Financial Hub & Upload</Text>
      <Text style={styles.subtitle}>
        Upload bank statements, insurance policies, loans, or log cash expenses with on-device AI analysis.
      </Text>

      {/* 4 Feature Tabs Segment */}
      <View style={styles.tabBar}>
        <PressableScale
          style={[styles.tabItem, activeTab === 'statement' && styles.tabItemActive]}
          onPress={() => handleTabChange('statement')}
        >
          <FileText size={14} color={activeTab === 'statement' ? '#0B0F0D' : theme.colors.textDim} />
          <Text style={[styles.tabText, activeTab === 'statement' && styles.tabTextActive]}>
            Statement
          </Text>
        </PressableScale>

        <PressableScale
          style={[styles.tabItem, activeTab === 'insurance' && styles.tabItemActive]}
          onPress={() => handleTabChange('insurance')}
        >
          <Shield size={14} color={activeTab === 'insurance' ? '#0B0F0D' : theme.colors.textDim} />
          <Text style={[styles.tabText, activeTab === 'insurance' && styles.tabTextActive]}>
            Insurance
          </Text>
        </PressableScale>

        <PressableScale
          style={[styles.tabItem, activeTab === 'account' && styles.tabItemActive]}
          onPress={() => handleTabChange('account')}
        >
          <Building size={14} color={activeTab === 'account' ? '#0B0F0D' : theme.colors.textDim} />
          <Text style={[styles.tabText, activeTab === 'account' && styles.tabTextActive]}>
            Accounts
          </Text>
        </PressableScale>

        <PressableScale
          style={[styles.tabItem, activeTab === 'cash' && styles.tabItemActive]}
          onPress={() => handleTabChange('cash')}
        >
          <Banknote size={14} color={activeTab === 'cash' ? '#0B0F0D' : theme.colors.textDim} />
          <Text style={[styles.tabText, activeTab === 'cash' && styles.tabTextActive]}>
            Cash
          </Text>
        </PressableScale>
      </View>

      {activeTab === 'statement' && <StatementScanner />}
      {activeTab === 'insurance' && <PolicyForm />}
      {activeTab === 'account' && <AccountForm />}
      {activeTab === 'cash' && <CashEntryForm />}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.bg,
    },
    wrap: {
      padding: 16,
      paddingBottom: 48,
    },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 44,
      marginBottom: 12,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    backText: {
      color: t.colors.accent,
      fontSize: 13,
      fontWeight: '700',
    },
    aiBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: t.colors.accentLight,
      borderWidth: 1,
      borderColor: 'rgba(255, 109, 0, 0.25)',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    aiBadgeText: {
      color: t.colors.accent,
      fontSize: 11,
      fontWeight: '800',
    },
    h1: {
      color: t.colors.text,
      fontSize: 26,
      fontWeight: '800',
      marginBottom: 4,
      letterSpacing: -0.5,
    },
    subtitle: {
      color: t.colors.textDim,
      fontSize: 13,
      marginBottom: 16,
      lineHeight: 18,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: t.colors.card,
      borderRadius: 16,
      padding: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
      marginBottom: 16,
      gap: 4,
    },
    tabItem: {
      flex: 1,
      flexDirection: 'row',
      gap: 4,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
    tabItemActive: {
      backgroundColor: t.colors.accent,
    },
    tabText: {
      color: t.colors.textDim,
      fontSize: 11,
      fontWeight: '700',
    },
    tabTextActive: {
      color: '#0B0F0D',
      fontWeight: '800',
    },
  })
);
