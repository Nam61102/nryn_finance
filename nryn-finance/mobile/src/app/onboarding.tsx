import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { requestPermission, isSupported } from '../native/sms.reader';
import { syncSms, markBackfillDone, type SyncProgress } from '../sync/sms.sync';
import { registerBackgroundSync } from '../sync/background.task';
import { theme } from '../theme';

/**
 * The explainer screen comes BEFORE the system dialog. Without it people deny
 * the permission and the app silently does nothing forever.
 */
export default function Onboarding() {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [granted, setGranted] = useState(false);

  const start = async () => {
    const ok = await requestPermission();
    setGranted(ok);
    if (!ok) {
      Alert.alert('Permission required', 'Please grant SMS permission in settings to automatically track bank expenses.');
      return;
    }
    await registerBackgroundSync().catch(() => {});
    const res = await syncSms({ full: true, onProgress: setProgress });
    if (res.phase === 'error') {
      Alert.alert('Sync failed', res.error || 'Failed to scan SMS inbox.');
      return;
    }
    if (res.read === 0) {
      Alert.alert(
        'No SMS Read',
        'Could not read any messages from the inbox. Please ensure SMS permission is granted in Android App Settings.',
        [
          { text: 'Try Again', onPress: () => start() },
          { text: 'Continue to Dashboard', onPress: () => router.replace('/(tabs)') },
        ],
      );
      return;
    }
    if (res.kept === 0) {
      const breakdown = Object.entries(res.rejected || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      Alert.alert(
        'Scan Finished',
        `Read ${res.read} messages, but 0 bank transaction messages were identified (${breakdown}). You can add expenses manually or pull down to refresh anytime.`,
        [
          { text: 'Continue to Dashboard', onPress: () => { markBackfillDone(); router.replace('/(tabs)'); } },
        ],
      );
      return;
    }
    await markBackfillDone();
    router.replace('/(tabs)');
  };

  if (!isSupported()) {
    let why = '';
    if (Platform.OS === 'web') {
      why = 'A browser cannot read SMS. This web view is for looking at your dashboard — add expenses with the + button, or use the Android app for automatic SMS capture.';
    } else if (Platform.OS === 'android') {
      why = 'Native SMS module is not detected. Please ensure you are running a custom development or standalone Android build (Expo Go cannot read SMS).';
    } else {
      why = "Apple gives no app access to the SMS inbox, by any method. On iOS this app works from Gmail and manual entries only — which covers cards and bills, but not same-day UPI spends.";
    }
    return (
      <View style={styles.wrap}>
        <Text style={styles.h1}>No SMS access here</Text>
        <Text style={styles.p}>{why}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.btnText}>Continue to dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>Reading your bank SMS</Text>
      <Text style={styles.p}>
        Your bank texts you every time money moves. This app reads those texts on
        this phone so you never type an expense again.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What actually leaves your phone</Text>
        <Text style={styles.li}>✓ Bank and UPI transaction messages only</Text>
        <Text style={styles.li}>✗ Messages from people — never read, never sent</Text>
        <Text style={styles.li}>✗ OTPs — explicitly excluded before anything is uploaded</Text>
        <Text style={styles.note}>
          The filter runs on this device, before the network call. Roughly 850 of
          20,000 messages pass it. This is how the app is built, not a promise.
        </Text>
      </View>

      {progress && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {progress.phase === 'done' ? 'Done' : progress.phase === 'error' ? 'Problem' : 'Scanning your inbox…'}
          </Text>
          <Text style={styles.li}>Read {progress.read} messages</Text>
          <Text style={styles.li}>Bank messages found: {progress.kept}</Text>
          <Text style={styles.li}>Uploaded {progress.uploaded} · duplicates {progress.duplicates}</Text>
          {progress.error && <Text style={[styles.li, { color: theme.danger }]}>{progress.error}</Text>}
        </View>
      )}

      <TouchableOpacity style={styles.btn} onPress={start} disabled={progress?.phase === 'reading' || progress?.phase === 'uploading'}>
        <Text style={styles.btnText}>{granted ? 'Scanning…' : 'Allow SMS access'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.skip}>Skip — I'll add expenses manually</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: theme.bg, padding: 24, justifyContent: 'center' },
  h1: { color: theme.text, fontSize: 26, fontWeight: '800', marginBottom: 10 },
  p: { color: theme.textDim, fontSize: 14, lineHeight: 21, marginBottom: 20 },
  card: { backgroundColor: theme.card, borderRadius: 18, padding: 18, marginBottom: 18 },
  cardTitle: { color: theme.text, fontWeight: '700', marginBottom: 10 },
  li: { color: theme.textDim, fontSize: 13, lineHeight: 22 },
  note: { color: theme.textDim, fontSize: 11, marginTop: 10, lineHeight: 17, opacity: 0.8 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, padding: 16, alignItems: 'center' },
  btnText: { color: '#0B0F0D', fontWeight: '800', fontSize: 15 },
  skip: { color: theme.textDim, textAlign: 'center', marginTop: 18, fontSize: 13 },
});
