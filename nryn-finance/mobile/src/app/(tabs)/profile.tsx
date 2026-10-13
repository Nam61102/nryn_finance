import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Sun, Moon, Smartphone, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react-native';
import { api, clearToken, API_BASE } from '../../services/api';
import { deleteItem } from '../../services/storage';
import { syncSms, getDeviceId } from '../../sync/sms.sync';
import { useTheme, makeStyles, Theme } from '../../theme';
import { haptic } from '../../utils/haptics';

export default function Profile() {
  const theme = useTheme();
  const styles = useStyles();
  const [health, setHealth] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [deviceId, setDeviceId] = useState('');
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setDeviceId(await getDeviceId());
    api.health().then(setHealth).catch(() => setHealth({ ok: false }));
    api.get<any>('/ingest/stats').then(setStats).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resync = async () => {
    setSyncing(true);
    haptic.medium();
    try {
      const p = await syncSms({ full: true });
      setSyncing(false);
      if (p.phase === 'error') {
        haptic.error();
        Alert.alert('Sync Error', p.error || 'Failed to scan SMS inbox');
      } else {
        haptic.success();
        const rej = Object.entries(p.rejected || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        Alert.alert(
          'Sync finished',
          `Total SMS read: ${p.read}\nBank messages found: ${p.kept}\nUploaded: ${p.uploaded}\nDuplicates: ${p.duplicates}${rej ? `\n(Filtered: ${rej})` : ''}`,
        );
      }
    } catch (e: any) {
      setSyncing(false);
      haptic.error();
      Alert.alert('Sync Error', e?.message || 'Sync failed');
    }
    load();
  };

  const handleSelectMode = (m: 'system' | 'light' | 'dark') => {
    haptic.light();
    theme.setMode(m);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Profile & Settings</Text>

      {/* Appearance Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Appearance</Text>
        <Text style={styles.cardSub}>Choose your preferred visual theme</Text>

        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentBtn, theme.mode === 'system' && styles.segmentBtnActive]}
            onPress={() => handleSelectMode('system')}
            activeOpacity={0.8}
          >
            <Smartphone size={16} color={theme.mode === 'system' ? theme.accent : theme.textDim} />
            <Text style={[styles.segmentText, theme.mode === 'system' && styles.segmentTextActive]}>
              System
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, theme.mode === 'light' && styles.segmentBtnActive]}
            onPress={() => handleSelectMode('light')}
            activeOpacity={0.8}
          >
            <Sun size={16} color={theme.mode === 'light' ? theme.accent : theme.textDim} />
            <Text style={[styles.segmentText, theme.mode === 'light' && styles.segmentTextActive]}>
              Light
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, theme.mode === 'dark' && styles.segmentBtnActive]}
            onPress={() => handleSelectMode('dark')}
            activeOpacity={0.8}
          >
            <Moon size={16} color={theme.mode === 'dark' ? theme.accent : theme.textDim} />
            <Text style={[styles.segmentText, theme.mode === 'dark' && styles.segmentTextActive]}>
              Dark
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sync Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>SMS Sync Engine</Text>
        <Row label="Last bank message" value={stats?.minutesSinceLastMessage != null ? `${stats.minutesSinceLastMessage} min ago` : 'never'} />
        <Row label="Parsed" value={String(stats?.byStatus?.parsed ?? 0)} />
        <Row label="Pending" value={String(stats?.byStatus?.pending ?? 0)} />
        <Row label="Unparsed" value={String(stats?.byStatus?.failed ?? 0)} />
        <Row label="Ignored (OTP etc.)" value={String(stats?.byStatus?.ignored ?? 0)} />
      </View>

      {/* Backend & Security Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Backend & Device</Text>
        <Row label="API Status" value={health?.ok ? 'Connected' : 'Offline'} />
        <Row label="Database" value={health?.mongo || '—'} />
        <Row label="AI Parser Fallback" value={health?.capabilities?.llmFallback ? 'Enabled' : 'Regex Only'} />
        <Row label="Device ID" value={deviceId ? `${deviceId.slice(0, 16)}...` : 'Unknown'} />
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.btnPrimary} onPress={resync} disabled={syncing} activeOpacity={0.85}>
        {syncing ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <View style={styles.btnRow}>
            <RefreshCw size={18} color="#FFFFFF" />
            <Text style={styles.btnPrimaryText}>Re-scan SMS Inbox</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnPrimary, { backgroundColor: theme.cardAlt, borderWidth: 1, borderColor: theme.border, marginTop: 10 }]}
        onPress={() => router.push('/onboarding')}
        activeOpacity={0.85}
      >
        <View style={styles.btnRow}>
          <Smartphone size={18} color={theme.accent} />
          <Text style={[styles.btnPrimaryText, { color: theme.text }]}>SMS Setup & Permissions</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnDanger}
        onPress={async () => {
          haptic.warning();
          await clearToken();
          await deleteItem('nryn_finance_onboarded');
          router.replace('/login');
        }}
        activeOpacity={0.85}
      >
        <View style={styles.btnRow}>
          <LogOut size={18} color={theme.danger} />
          <Text style={styles.btnDangerText}>Sign Out</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
};

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
    h1: { color: t.text, fontSize: 24, fontWeight: '800', marginBottom: 18 },
    card: {
      backgroundColor: t.card,
      borderRadius: t.radius.md,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: t.border,
      ...t.shadows.sm,
    },
    cardTitle: { color: t.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
    cardSub: { color: t.textDim, fontSize: 13, marginBottom: 12 },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: t.cardAlt,
      borderRadius: t.radius.sm,
      padding: 4,
      gap: 4,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: t.radius.sm - 2,
    },
    segmentBtnActive: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      ...t.shadows.sm,
    },
    segmentText: { color: t.textDim, fontSize: 12, fontWeight: '600' },
    segmentTextActive: { color: t.text, fontWeight: '800' },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.cardAlt,
    },
    rowLabel: { color: t.textDim, fontSize: 13 },
    rowValue: { color: t.text, fontSize: 13, fontWeight: '600', maxWidth: '60%' },
    btnPrimary: {
      backgroundColor: t.accent,
      borderRadius: t.radius.md,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 6,
      ...t.shadows.md,
    },
    btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    btnPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
    btnDanger: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.dangerBorder,
      borderRadius: t.radius.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 12,
    },
    btnDangerText: { color: t.danger, fontWeight: '800', fontSize: 15 },
  })
);
