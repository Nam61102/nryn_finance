import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, clearToken, API_BASE } from '../../services/api';
import { syncSms, getDeviceId } from '../../sync/sms.sync';
import { theme } from '../../theme';

export default function Profile() {
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
    try {
      const p = await syncSms({ full: true });
      setSyncing(false);
      if (p.phase === 'error') {
        Alert.alert('Sync Error', p.error || 'Failed to scan SMS inbox');
      } else {
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
      Alert.alert('Sync Error', e?.message || 'Sync failed');
    }
    load();
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 40 }}>
      <Text style={styles.h1}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync status</Text>
        {/* Silent ingest death is this system's characteristic failure mode,
            so the age of the last message is shown, not just "connected". */}
        <Row k="Last bank message" v={stats?.minutesSinceLastMessage != null ? `${stats.minutesSinceLastMessage} min ago` : 'never'} />
        <Row k="Parsed" v={String(stats?.byStatus?.parsed ?? 0)} />
        <Row k="Pending" v={String(stats?.byStatus?.pending ?? 0)} />
        <Row k="Unparsed" v={String(stats?.byStatus?.failed ?? 0)} />
        <Row k="Ignored (OTP etc.)" v={String(stats?.byStatus?.ignored ?? 0)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Backend</Text>
        <Row k="API" v={API_BASE} />
        <Row k="Mongo" v={health?.mongo || '—'} />
        <Row k="LLM fallback" v={health?.capabilities?.llmFallback ? 'on' : 'off (regex only)'} />
        <Row k="Gmail" v={health?.capabilities?.gmail ? 'configured' : 'not configured'} />
        <Row k="Device" v={deviceId.slice(0, 18)} />
      </View>

      <TouchableOpacity style={styles.btn} onPress={resync} disabled={syncing}>
        <Text style={styles.btnText}>{syncing ? 'Scanning…' : 'Re-scan full SMS history'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.ghost]} onPress={async () => { await clearToken(); router.replace('/login'); }}>
        <Text style={[styles.btnText, { color: theme.danger }]}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <View style={styles.row}>
    <Text style={styles.k}>{k}</Text>
    <Text style={styles.v} numberOfLines={1}>{v}</Text>
  </View>
);

const styles = StyleSheet.create({
  h1: { color: theme.text, fontSize: 24, fontWeight: '800', marginBottom: 18 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTitle: { color: theme.text, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, gap: 16 },
  k: { color: theme.textDim, fontSize: 13 },
  v: { color: theme.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  btn: {
    backgroundColor: theme.accent,
    borderRadius: 14,
    padding: 15,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: theme.accent,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  ghost: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 10,
  },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
