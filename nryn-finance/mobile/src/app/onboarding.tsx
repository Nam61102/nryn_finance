import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { Check, X, Shield, ArrowRight } from 'lucide-react-native';
import { requestPermission, isSupported } from '../native/sms.reader';
import { syncSms, markBackfillDone, type SyncProgress } from '../sync/sms.sync';
import { registerBackgroundSync } from '../sync/background.task';
import { useTheme, makeStyles } from '../theme';
import { triggerHaptic } from '../utils/haptics';
import PressableScale from '../components/ui/PressableScale';
import Button from '../components/ui/Button';

/**
 * The explainer screen comes BEFORE the system dialog. Without it people deny
 * the permission and the app silently does nothing forever.
 */
export default function Onboarding() {
  const theme = useTheme();
  const styles = useStyles();
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [granted, setGranted] = useState(false);

  const start = async () => {
    triggerHaptic('medium');
    const ok = await requestPermission();
    setGranted(ok);
    if (!ok) {
      triggerHaptic('warning');
      Alert.alert(
        'Permission required',
        'Please grant SMS permission in settings to automatically track bank expenses.'
      );
      return;
    }
    await registerBackgroundSync().catch(() => {});
    const res = await syncSms({ full: true, onProgress: setProgress });
    if (res.phase === 'error') {
      triggerHaptic('error');
      Alert.alert('Sync failed', res.error || 'Failed to scan SMS inbox.');
      return;
    }
    if (res.read === 0) {
      triggerHaptic('warning');
      Alert.alert(
        'No SMS Read',
        'Could not read any messages from the inbox. Please ensure SMS permission is granted in Android App Settings.',
        [
          { text: 'Try Again', onPress: () => start() },
          { text: 'Continue to Dashboard', onPress: () => router.replace('/(tabs)') },
        ]
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
          {
            text: 'Continue to Dashboard',
            onPress: () => {
              markBackfillDone();
              router.replace('/(tabs)');
            },
          },
        ]
      );
      return;
    }
    triggerHaptic('success');
    await markBackfillDone();
    router.replace('/(tabs)');
  };

  if (!isSupported()) {
    let why = '';
    if (Platform.OS === 'web') {
      why =
        'A browser cannot read SMS. This web view is for looking at your dashboard — add expenses with the + button, or use the Android app for automatic SMS capture.';
    } else if (Platform.OS === 'android') {
      why =
        'Native SMS module is not detected. Please ensure you are running a custom development or standalone Android build (Expo Go cannot read SMS).';
    } else {
      why =
        'Apple gives no app access to the SMS inbox, by any method. On iOS this app works from Gmail and manual entries only — which covers cards and bills, but not same-day UPI spends.';
    }
    return (
      <View style={styles.wrap}>
        <View style={styles.shieldWrap}>
          <Shield size={36} color={theme.colors.accent} />
        </View>
        <Text style={styles.h1}>No SMS access here</Text>
        <Text style={styles.p}>{why}</Text>
        <Button
          title="Continue to Dashboard"
          onPress={() => router.replace('/(tabs)')}
          size="lg"
          variant="primary"
          style={styles.btn}
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.shieldWrap}>
        <Shield size={36} color={theme.colors.accent} />
      </View>

      <Text style={styles.h1}>Reading your bank SMS</Text>
      <Text style={styles.p}>
        Your bank texts you every time money moves. This app reads those texts on
        this phone so you never type an expense again.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What actually leaves your phone</Text>
        <View style={styles.liRow}>
          <Check size={16} color="#10B981" />
          <Text style={styles.li}>Bank and UPI transaction messages only</Text>
        </View>
        <View style={styles.liRow}>
          <X size={16} color="#FF4757" />
          <Text style={styles.li}>Messages from people — never read, never sent</Text>
        </View>
        <View style={styles.liRow}>
          <X size={16} color="#FF4757" />
          <Text style={styles.li}>OTPs — explicitly excluded before anything is uploaded</Text>
        </View>
        <Text style={styles.note}>
          The filter runs on this device, before the network call. Roughly 850 of
          20,000 messages pass it. This is how the app is built, not a promise.
        </Text>
      </View>

      {progress && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {progress.phase === 'done'
              ? 'Scan Complete'
              : progress.phase === 'error'
              ? 'Problem Occurred'
              : 'Scanning your inbox…'}
          </Text>
          <Text style={styles.progText}>Read {progress.read} messages</Text>
          <Text style={styles.progText}>Bank messages found: {progress.kept}</Text>
          <Text style={styles.progText}>
            Uploaded {progress.uploaded} · duplicates {progress.duplicates}
          </Text>
          {progress.error && (
            <Text style={[styles.progText, { color: theme.colors.danger }]}>
              {progress.error}
            </Text>
          )}
        </View>
      )}

      <Button
        title={granted ? 'Scanning…' : 'Allow SMS Access'}
        onPress={start}
        loading={progress?.phase === 'reading' || progress?.phase === 'uploading'}
        size="lg"
        variant="primary"
        icon={<ArrowRight size={18} color="#0B0F0D" />}
        style={styles.btn}
      />

      <PressableScale
        onPress={() => router.replace('/(tabs)')}
        style={styles.skipWrap}
      >
        <Text style={styles.skip}>Skip — I'll add expenses manually</Text>
      </PressableScale>
    </ScrollView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    wrap: {
      flexGrow: 1,
      backgroundColor: t.colors.bg,
      padding: 24,
      justifyContent: 'center',
    },
    shieldWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: t.colors.accentLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    h1: {
      color: t.colors.text,
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    p: {
      color: t.colors.textDim,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 24,
    },
    card: {
      backgroundColor: t.colors.card,
      borderRadius: 20,
      padding: 18,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    cardTitle: {
      color: t.colors.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 12,
    },
    liRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    li: {
      color: t.colors.text,
      fontSize: 13,
      flex: 1,
      lineHeight: 18,
    },
    progText: {
      color: t.colors.textDim,
      fontSize: 13,
      lineHeight: 22,
    },
    note: {
      color: t.colors.textDim,
      fontSize: 11,
      marginTop: 10,
      lineHeight: 16,
      opacity: 0.8,
    },
    btn: {
      marginTop: 6,
    },
    skipWrap: {
      alignSelf: 'center',
      marginTop: 18,
      paddingVertical: 6,
    },
    skip: {
      color: t.colors.textDim,
      fontSize: 13,
      fontWeight: '500',
    },
  })
);
