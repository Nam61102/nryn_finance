import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Alert, ActivityIndicator, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Check, X, Shield, ArrowRight, Sparkles, Database, FileText, Globe } from 'lucide-react-native';
import { requestPermission, isSupported } from '../native/sms.reader';
import { syncSms, markBackfillDone, type SyncProgress } from '../sync/sms.sync';
import { registerBackgroundSync } from '../sync/background.task';
import { useTheme, makeStyles } from '../theme';
import { triggerHaptic } from '../utils/haptics';
import PressableScale from '../components/ui/PressableScale';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import { setItem } from '../services/storage';

/**
 * Reading your bank SMS — Onboarding screen.
 * Explains SMS privacy and triggers permission / inbox scan, real SMS paste, or sample demo data.
 */
export default function Onboarding() {
  const theme = useTheme();
  const styles = useStyles();
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [granted, setGranted] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pastedSms, setPastedSms] = useState('');
  const [pastingSms, setPastingSms] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState<string | null>(null);

  const finishAndGo = async () => {
    await setItem('nryn_finance_onboarded', 'true');
    router.replace('/(tabs)');
  };

  const loadSampleData = async () => {
    triggerHaptic('medium');
    setLoadingDemo(true);
    setProgress({
      phase: 'reading',
      read: 24,
      kept: 20,
      uploaded: 12,
      duplicates: 0,
      rejected: {},
    });
    try {
      await api.seedDemo();
      triggerHaptic('success');
      setProgress({
        phase: 'done',
        read: 24,
        kept: 20,
        uploaded: 20,
        duplicates: 0,
        rejected: {},
      });
      await setItem('nryn_finance_onboarded', 'true');
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 600);
    } catch (err: any) {
      console.warn('loadSampleData error', err);
      await setItem('nryn_finance_onboarded', 'true');
      router.replace('/(tabs)');
    } finally {
      setLoadingDemo(false);
    }
  };

  const handlePasteSms = async () => {
    if (!pastedSms.trim()) {
      triggerHaptic('warning');
      return Alert.alert('Empty SMS', 'Please paste a real bank transaction SMS.');
    }
    triggerHaptic('medium');
    setPastingSms(true);
    setPasteSuccess(null);
    try {
      const res = await api.pasteSms(pastedSms.trim());
      if (res.accepted > 0 && res.transactions?.length > 0) {
        triggerHaptic('success');
        const count = res.transactions.length;
        setPasteSuccess(`Successfully parsed ${count} real transaction${count > 1 ? 's' : ''}!`);
        await setItem('nryn_finance_onboarded', 'true');
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1200);
      } else {
        triggerHaptic('error');
        Alert.alert(
          'Could Not Parse SMS',
          'We could not find recognized bank transaction patterns in the pasted text. Please verify it is a bank debit or credit SMS message.'
        );
      }
    } catch (err: any) {
      triggerHaptic('error');
      Alert.alert('Error', err?.message || 'Failed to process pasted SMS');
    } finally {
      setPastingSms(false);
    }
  };

  const start = async () => {
    triggerHaptic('medium');
    setSyncing(true);

    // 1. Android Native Environment with native module
    if (Platform.OS === 'android' && isSupported()) {
      try {
        const ok = await requestPermission();
        setGranted(ok);

        if (ok) {
          await registerBackgroundSync().catch(() => {});
          const res = await syncSms({ full: true, onProgress: setProgress });
          if (res.phase !== 'error' && res.read > 0) {
            triggerHaptic('success');
            await markBackfillDone();
            await setItem('nryn_finance_onboarded', 'true');
            setSyncing(false);
            if (res.kept === 0) {
              Alert.alert(
                 'Inbox Scanned',
                `Scanned ${res.read} messages, but no recognized bank transaction texts were found.\n\nYou can still use the app with ₹0 or paste SMS manually!`,
                [
                  {
                    text: 'Go to Dashboard',
                    onPress: () => {
                      try {
                        router.replace('/(tabs)');
                      } catch {
                        router.replace('/');
                      }
                    },
                  },
                ]
              );
            } else {
              Alert.alert(
                'Scan Complete 🎉',
                `Scanned ${res.read} messages and successfully imported ${res.kept} bank transaction${res.kept === 1 ? '' : 's'}!`,
                [
                  {
                    text: 'Next: Set Budget',
                    onPress: () => {
                      try {
                        router.replace('/budget-setup' as any);
                      } catch {
                        router.replace('/budget-setup' as any);
                      }
                    },
                  },
                ]
              );
            }
            return;
          } else if (res.phase === 'error') {
            Alert.alert('SMS Sync Notice', res.error || 'No SMS could be read from device.');
            setSyncing(false);
            return;
          } else {
            Alert.alert('Empty Inbox', 'No SMS messages were found in the inbox.');
            setSyncing(false);
            return;
          }
        } else {
          Alert.alert('Permission Denied', 'SMS permission is required to automatically read bank messages on Android.');
          setSyncing(false);
          return;
        }
      } catch (err: any) {
        console.warn('Native SMS sync error', err);
        Alert.alert('Sync Error', err?.message || 'Failed to scan inbox.');
        setSyncing(false);
        return;
      }
    }

    // 2. Web or unsupported platform:
    setSyncing(false);
    Alert.alert(
      'Web Browser Notice',
      'Google Chrome and Web Browsers cannot access your phone inbox due to Android OS security protections.\n\nPlease paste your real bank SMS in the box below, or skip to start clean with ₹0.',
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
      <View style={styles.contentContainer}>
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

        {Platform.OS === 'web' && (
          <View style={styles.webNoticeCard}>
            <View style={styles.webBadgeRow}>
              <Globe size={18} color="#FF9800" />
              <Text style={styles.webBadgeTitle}>Web Browser Mode (Chrome / Netlify)</Text>
            </View>
            <Text style={styles.webNoticeText}>
              Web browsers cannot read your phone's SMS inbox due to Android OS security restrictions. Automatic SMS scanning runs inside the Android app.
            </Text>
            <Text style={[styles.webNoticeText, { marginTop: 6, fontWeight: '700' }]}>
              To see your genuine bank data right now, paste your bank SMS below:
            </Text>
          </View>
        )}

        {/* Real SMS Ingestion Box */}
        <View style={styles.pasteCard}>
          <View style={styles.pasteHeaderRow}>
            <FileText size={18} color={theme.colors.accent} />
            <Text style={styles.pasteCardTitle}>Paste Your Real Bank SMS</Text>
          </View>
          <Text style={styles.pasteSub}>
            Copy any debit/credit SMS from your bank (HDFC, SBI, ICICI, Axis, Kotak, UPI) and paste it here. We will instantly extract the real amount, merchant, and bank!
          </Text>
          <TextInput
            style={styles.pasteInput}
            placeholder="e.g. Rs.450.00 debited from a/c XX1234 on 13-10-26 to VPA zomato@ybl. Ref 42871928374."
            placeholderTextColor={theme.colors.textDim}
            multiline
            numberOfLines={4}
            value={pastedSms}
            onChangeText={setPastedSms}
          />

          {pasteSuccess && (
            <View style={styles.pasteSuccessBadge}>
              <Check size={16} color="#10B981" />
              <Text style={styles.pasteSuccessText}>{pasteSuccess}</Text>
            </View>
          )}

          <Button
            title={pastingSms ? 'Parsing Your SMS…' : 'Parse & Record Real Transaction'}
            onPress={handlePasteSms}
            loading={pastingSms}
            size="md"
            variant="primary"
            icon={<ArrowRight size={16} color="#FFFFFF" />}
            style={{ marginTop: 10, backgroundColor: theme.colors.accent }}
          />
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
          title={
            Platform.OS === 'web'
              ? 'Allow SMS access (Android APK Only)'
              : syncing
              ? 'Scanning & Reading Bank SMS…'
              : 'Allow SMS access'
          }
          onPress={start}
          loading={syncing || progress?.phase === 'reading' || progress?.phase === 'uploading'}
          size="lg"
          variant="primary"
          icon={<ArrowRight size={18} color="#FFFFFF" />}
          style={styles.btn}
        />

        <PressableScale onPress={finishAndGo} style={styles.skipWrap}>
          <Text style={styles.skip}>Skip — Start with Clean Account (₹0 Spends)</Text>
        </PressableScale>
      </View>
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
    contentContainer: {
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
      paddingVertical: 20,
    },
    shieldWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: t.colors.accentLight || '#FFF3E0',
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
      backgroundColor: '#FF5722',
    },
    demoBtn: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    skipWrap: {
      alignSelf: 'center',
      marginTop: 20,
      paddingVertical: 8,
    },
    skip: {
      color: t.colors.textDim,
      fontSize: 13,
      fontWeight: '500',
    },
    webNoticeCard: {
      backgroundColor: '#FFF8E1',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: '#FFE082',
    },
    webBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    webBadgeTitle: {
      color: '#B78103',
      fontSize: 14,
      fontWeight: '800',
    },
    webNoticeText: {
      color: '#5D4037',
      fontSize: 12,
      lineHeight: 18,
    },
    pasteCard: {
      backgroundColor: t.colors.card,
      borderRadius: 20,
      padding: 18,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: t.colors.accent,
    },
    pasteHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    pasteCardTitle: {
      color: t.colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    pasteSub: {
      color: t.colors.textDim,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 12,
    },
    pasteInput: {
      backgroundColor: t.colors.bg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: 12,
      color: t.colors.text,
      fontSize: 13,
      textAlignVertical: 'top',
      minHeight: 80,
    },
    pasteSuccessBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#E8F5E9',
      padding: 10,
      borderRadius: 8,
      marginTop: 10,
    },
    pasteSuccessText: {
      color: '#2E7D32',
      fontSize: 13,
      fontWeight: '700',
    },
  })
);
