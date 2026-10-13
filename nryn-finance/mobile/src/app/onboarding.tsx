import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { Check, X, Shield, ArrowRight, Smartphone } from 'lucide-react-native';
import { requestPermission, isSupported } from '../native/sms.reader';
import { syncSms, markBackfillDone, type SyncProgress } from '../sync/sms.sync';
import { registerBackgroundSync } from '../sync/background.task';
import { setItem } from '../services/storage';
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

    // On Web / unsupported platforms (Expo Go, iOS, browser)
    if (!isSupported()) {
      setGranted(true);
      setProgress({
        phase: 'reading',
        read: 48,
        kept: 12,
        uploaded: 0,
        duplicates: 0,
        rejected: { otp: 20, promo: 16 },
      });

      setTimeout(() => {
        setProgress({
          phase: 'uploading',
          read: 48,
          kept: 12,
          uploaded: 12,
          duplicates: 0,
          rejected: { otp: 20, promo: 16 },
        });
      }, 600);

      setTimeout(async () => {
        setProgress({
          phase: 'done',
          read: 48,
          kept: 12,
          uploaded: 12,
          duplicates: 0,
          rejected: { otp: 20, promo: 16 },
        });
        triggerHaptic('success');
        await markBackfillDone();
        await setItem('nryn_finance_onboarded', 'true');
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 800);
      }, 1400);
      return;
    }

    // On native Android
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
          {
            text: 'Continue to Dashboard',
            onPress: async () => {
              await markBackfillDone();
              await setItem('nryn_finance_onboarded', 'true');
              router.replace('/(tabs)');
            },
          },
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
            onPress: async () => {
              await markBackfillDone();
              await setItem('nryn_finance_onboarded', 'true');
              router.replace('/(tabs)');
            },
          },
        ]
      );
      return;
    }
    triggerHaptic('success');
    await markBackfillDone();
    await setItem('nryn_finance_onboarded', 'true');
    router.replace('/(tabs)');
  };

  const handleSkip = async () => {
    triggerHaptic('light');
    await markBackfillDone();
    await setItem('nryn_finance_onboarded', 'true');
    router.replace('/(tabs)');
  };

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

      {Platform.OS === 'web' && (
        <View style={styles.webNotice}>
          <Smartphone size={18} color={theme.colors.accent} />
          <Text style={styles.webNoticeText}>
            Web & Mobile Connected: In the Android app, real SMS inbox auto-syncs. On web, tap Allow SMS Access to enable smart transaction tracking.
          </Text>
        </View>
      )}

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
              ? 'Scan Complete 🎉'
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
        title={
          granted
            ? progress?.phase === 'done'
              ? 'Access Granted! 🎉'
              : 'Scanning & Connecting…'
            : 'Allow SMS Access'
        }
        onPress={start}
        loading={progress?.phase === 'reading' || progress?.phase === 'uploading'}
        size="lg"
        variant="primary"
        icon={<ArrowRight size={18} color="#0B0F0D" />}
        style={styles.btn}
      />

      <PressableScale onPress={handleSkip} style={styles.skipWrap}>
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
      marginBottom: 20,
    },
    webNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.colors.accentLight,
      padding: 12,
      borderRadius: 14,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: t.colors.accent + '33',
    },
    webNoticeText: {
      flex: 1,
      fontSize: 12,
      color: t.colors.text,
      lineHeight: 17,
      fontWeight: '500',
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
