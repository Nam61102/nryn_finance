import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import {
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Eye,
  EyeOff,
  User as UserIcon,
  KeyRound,
  X,
  Check,
  Shield,
  Database,
  FileText,
  Globe,
} from 'lucide-react-native';
import { api, setToken, API_BASE } from '../services/api';
import { useTheme, makeStyles } from '../theme';
import { triggerHaptic } from '../utils/haptics';
import PressableScale from '../components/ui/PressableScale';
import Button from '../components/ui/Button';
import { setItem, deleteItem } from '../services/storage';
import { requestPermission, isSupported } from '../native/sms.reader';
import { syncSms, markBackfillDone, type SyncProgress } from '../sync/sms.sync';
import { registerBackgroundSync } from '../sync/background.task';

export default function Login() {
  const theme = useTheme();
  const styles = useStyles();

  // Mode: Sign In or Create Account
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Multi-step: 'auth' -> 'sms' (instant transition upon login)
  const [step, setStep] = useState<'auth' | 'sms'>('auth');
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [smsGranted, setSmsGranted] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  // Input states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  // Success notification state
  const [successInfo, setSuccessInfo] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // Forgot password modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

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

  const startSmsScan = async () => {
    triggerHaptic('medium');
    setSyncing(true);

    // 1. Android Native Environment with native module
    if (Platform.OS === 'android' && isSupported()) {
      try {
        const ok = await requestPermission();
        setSmsGranted(ok);

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

  const handleRegisterDirect = async (regEmail: string, regPass: string, regName?: string) => {
    setBusy(true);
    try {
      const res = await api.register(regEmail.trim(), regPass, regName?.trim() || undefined);
      await setToken(res.token);
      await deleteItem('nryn_finance_onboarded');
      triggerHaptic('success');
      setStep('sms');
    } catch (err: any) {
      triggerHaptic('error');
      const msg = err.body?.message || err.body?.error || err.message || 'Registration failed';
      Alert.alert('Registration Error', msg);
    } finally {
      setBusy(false);
    }
  };

  const handleLoginDirect = async (loginEmail: string, loginPass: string) => {
    setBusy(true);
    try {
      const res = await api.login(loginEmail.trim(), loginPass);
      await setToken(res.token);
      await deleteItem('nryn_finance_onboarded');
      triggerHaptic('success');
      setStep('sms');
    } catch (err: any) {
      triggerHaptic('error');
      const msg = err.body?.message || err.body?.error || err.message || 'Sign in failed';
      Alert.alert('Sign In Error', msg);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      triggerHaptic('warning');
      return Alert.alert('Missing Email', 'Please enter your email address.');
    }
    if (!password) {
      triggerHaptic('warning');
      return Alert.alert('Missing Password', 'Please enter your password.');
    }
    if (password.length < 8) {
      triggerHaptic('warning');
      return Alert.alert('Password Too Short', 'Password must be at least 8 characters long.');
    }
    if (mode === 'register' && confirmPassword && password !== confirmPassword) {
      triggerHaptic('warning');
      return Alert.alert('Passwords Do Not Match', 'Please ensure both passwords match.');
    }

    triggerHaptic('medium');
    setBusy(true);

    try {
      if (mode === 'login') {
        const res = await api.login(trimmedEmail, password);
        await setToken(res.token);
        await deleteItem('nryn_finance_onboarded');
        triggerHaptic('success');
        setStep('sms');
      } else {
        const res = await api.register(trimmedEmail, password, name.trim() || undefined);
        await setToken(res.token);
        await deleteItem('nryn_finance_onboarded');
        triggerHaptic('success');
        setStep('sms');
      }
    } catch (e: any) {
      triggerHaptic('error');
      const errCode = e.body?.error || '';
      const errMsg = e.body?.message || e.message || '';

      // If user tried to sign in, but no account exists:
      if (mode === 'login' && (errCode === 'user_not_found' || e.status === 404)) {
        Alert.alert(
          'No Account Found',
          `There is no account registered with "${trimmedEmail}".\n\nWould you like to create a new account now?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Create Account',
              style: 'default',
              onPress: () => {
                setMode('register');
                handleRegisterDirect(trimmedEmail, password, name);
              },
            },
          ]
        );
        return;
      }

      // If user tried to create account, but email is already registered:
      if (mode === 'register' && (errCode === 'email_taken' || e.status === 409)) {
        Alert.alert(
          'Account Already Exists',
          `An account with "${trimmedEmail}" is already registered.\n\nWould you like to sign in?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign In',
              style: 'default',
              onPress: () => {
                setMode('login');
                handleLoginDirect(trimmedEmail, password);
              },
            },
          ]
        );
        return;
      }

      if (e.status === 401 || errCode === 'invalid_credentials' || errCode === 'incorrect_password') {
        Alert.alert(
          'Sign In Failed',
          'Incorrect password. Please check your password or tap "Forgot Password?" below.',
          [
            { text: 'Try Again' },
            {
              text: 'Forgot Password?',
              onPress: () => {
                setForgotEmail(trimmedEmail);
                setShowForgotModal(true);
              },
            },
          ]
        );
      } else {
        Alert.alert('Could Not Connect', `${errMsg || errCode || 'Network error'}\n\nServer: ${API_BASE}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResetPasswordSubmit = async () => {
    const trimmedEmail = forgotEmail.trim();
    if (!trimmedEmail) {
      triggerHaptic('warning');
      return Alert.alert('Missing Email', 'Please enter your registered email address.');
    }
    if (!forgotNewPassword || forgotNewPassword.length < 8) {
      triggerHaptic('warning');
      return Alert.alert('Password Too Short', 'New password must be at least 8 characters long.');
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      triggerHaptic('warning');
      return Alert.alert('Passwords Do Not Match', 'Please ensure both passwords match.');
    }

    triggerHaptic('medium');
    setForgotBusy(true);

    try {
      const res = await api.resetPassword(trimmedEmail, forgotNewPassword);
      triggerHaptic('success');
      Alert.alert(
        'Password Reset Successful',
        res.message || 'Your password has been updated. You can now sign in with your new password.',
        [
          {
            text: 'Sign In Now',
            onPress: () => {
              setEmail(trimmedEmail);
              setPassword(forgotNewPassword);
              setMode('login');
              setShowForgotModal(false);
            },
          },
        ]
      );
    } catch (err: any) {
      triggerHaptic('error');
      const msg = err.body?.message || err.body?.error || err.message || 'Could not reset password';
      Alert.alert('Reset Failed', msg);
    } finally {
      setForgotBusy(false);
    }
  };

  if (step === 'sms') {
    return (
      <ScrollView contentContainerStyle={styles.smsWrap} showsVerticalScrollIndicator={false}>
        <View style={styles.smsContainer}>
          <View style={styles.smsShieldWrap}>
            <Shield size={36} color={theme.colors.accent} />
          </View>

          <Text style={styles.smsH1}>Reading your bank SMS</Text>
          <Text style={styles.smsP}>
            Your bank texts you every time money moves. This app reads those texts on
            this phone so you never type an expense again.
          </Text>

          <View style={styles.smsCard}>
            <Text style={styles.smsCardTitle}>What actually leaves your phone</Text>
            <View style={styles.smsLiRow}>
              <Check size={16} color="#10B981" />
              <Text style={styles.smsLi}>Bank and UPI transaction messages only</Text>
            </View>
            <View style={styles.smsLiRow}>
              <X size={16} color="#FF4757" />
              <Text style={styles.smsLi}>Messages from people — never read, never sent</Text>
            </View>
            <View style={styles.smsLiRow}>
              <X size={16} color="#FF4757" />
              <Text style={styles.smsLi}>OTPs — explicitly excluded before anything is uploaded</Text>
            </View>
            <Text style={styles.smsNote}>
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
          <View style={styles.smsCard}>
            <Text style={styles.smsCardTitle}>
              {progress.phase === 'done'
                ? 'Scan Complete'
                : progress.phase === 'error'
                ? 'Problem Occurred'
                : 'Scanning your inbox…'}
            </Text>
            <Text style={styles.smsProgText}>Read {progress.read} messages</Text>
            <Text style={styles.smsProgText}>Bank messages found: {progress.kept}</Text>
            <Text style={styles.smsProgText}>
              Uploaded {progress.uploaded} · duplicates {progress.duplicates}
            </Text>
            {progress.error && (
              <Text style={[styles.smsProgText, { color: theme.colors.danger }]}>
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
          onPress={startSmsScan}
          loading={syncing || progress?.phase === 'reading' || progress?.phase === 'uploading'}
          size="lg"
          variant="primary"
          icon={<ArrowRight size={18} color="#FFFFFF" />}
          style={styles.smsBtn}
        />

        <PressableScale onPress={finishAndGo} style={styles.smsSkipWrap}>
          <Text style={styles.smsSkip}>Skip — Start with Clean Account (₹0 Spends)</Text>
        </PressableScale>
      </View>
    </ScrollView>
  );
}

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      {/* Brand Header */}
      <View style={styles.brandRow}>
        <View style={styles.logoBadge}>
          <Sparkles size={24} color="#0B0F0D" />
        </View>
        <Text style={styles.logo}>NRYN</Text>
      </View>
      <Text style={styles.brandTitle}>Finance</Text>
      <Text style={styles.sub}>
        Your spends, read from your own SMS inbox. 100% private and on-device.
      </Text>

      {/* Prominent Mode Selector Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => {
            triggerHaptic('selection');
            setMode('login');
          }}
          style={[
            styles.tabButton,
            mode === 'login' && {
              backgroundColor: theme.colors.accent,
            },
          ]}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              { color: mode === 'login' ? '#0B0F0D' : theme.colors.textDim },
            ]}
          >
            Sign In
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            triggerHaptic('selection');
            setMode('register');
          }}
          style={[
            styles.tabButton,
            mode === 'register' && {
              backgroundColor: theme.colors.accent,
            },
          ]}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              { color: mode === 'register' ? '#0B0F0D' : theme.colors.textDim },
            ]}
          >
            Create Account
          </Text>
        </TouchableOpacity>
      </View>

      {/* Inputs Form */}
      {mode === 'register' && (
        <View style={styles.inputContainer}>
          <UserIcon size={18} color={theme.colors.textDim} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Full Name (optional)"
            placeholderTextColor={theme.colors.textDim}
            value={name}
            onChangeText={setName}
          />
        </View>
      )}

      <View style={styles.inputContainer}>
        <Mail size={18} color={theme.colors.textDim} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor={theme.colors.textDim}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      </View>

      <View style={styles.inputContainer}>
        <Lock size={18} color={theme.colors.textDim} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Password (min 8 characters)"
          placeholderTextColor={theme.colors.textDim}
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {showPassword ? (
            <EyeOff size={18} color={theme.colors.textDim} />
          ) : (
            <Eye size={18} color={theme.colors.textDim} />
          )}
        </TouchableOpacity>
      </View>

      {mode === 'register' && (
        <View style={styles.inputContainer}>
          <Lock size={18} color={theme.colors.textDim} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={theme.colors.textDim}
            secureTextEntry={!showPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>
      )}

      {/* Forgot Password Button (Visible in Sign In mode) */}
      {mode === 'login' && (
        <TouchableOpacity
          onPress={() => {
            triggerHaptic('light');
            setForgotEmail(email.trim());
            setShowForgotModal(true);
          }}
          style={styles.forgotBtn}
          activeOpacity={0.7}
        >
          <KeyRound size={13} color={theme.colors.accent} style={{ marginRight: 4 }} />
          <Text style={[styles.forgotText, { color: theme.colors.accent }]}>
            Forgot Password?
          </Text>
        </TouchableOpacity>
      )}

      {/* Primary Submit Button */}
      <Button
        title={mode === 'login' ? 'Sign In' : 'Create Account'}
        onPress={submit}
        loading={busy}
        size="lg"
        variant="primary"
        icon={<ArrowRight size={18} color="#0B0F0D" />}
        style={styles.btn}
      />

      {/* Switch Mode Helper Link */}
      <PressableScale
        onPress={() => {
          triggerHaptic('selection');
          setMode(mode === 'login' ? 'register' : 'login');
        }}
        style={styles.switchBtn}
      >
        <Text style={styles.link}>
          {mode === 'login'
            ? "New to NRYN? Tap here to Create an Account"
            : 'Already have an account? Tap here to Sign In'}
        </Text>
      </PressableScale>

      {/* Security Badge */}
      <View style={styles.securityPill}>
        <ShieldCheck size={14} color="#10B981" />
        <Text style={styles.securityText}>AES encrypted · On-device parsing</Text>
      </View>

      <Text style={styles.api}>API: {API_BASE}</Text>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <KeyRound size={20} color={theme.colors.accent} />
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  Reset Password
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowForgotModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.colors.textDim }]}>
              Enter your registered email address and choose a new password.
            </Text>

            {/* Email Field */}
            <View style={styles.modalInputContainer}>
              <Mail size={16} color={theme.colors.textDim} style={styles.inputIcon} />
              <TextInput
                style={styles.modalInput}
                placeholder="Registered email address"
                placeholderTextColor={theme.colors.textDim}
                autoCapitalize="none"
                keyboardType="email-address"
                value={forgotEmail}
                onChangeText={setForgotEmail}
              />
            </View>

            {/* New Password */}
            <View style={styles.modalInputContainer}>
              <Lock size={16} color={theme.colors.textDim} style={styles.inputIcon} />
              <TextInput
                style={styles.modalInput}
                placeholder="New password (min 8 characters)"
                placeholderTextColor={theme.colors.textDim}
                secureTextEntry
                value={forgotNewPassword}
                onChangeText={setForgotNewPassword}
              />
            </View>

            {/* Confirm New Password */}
            <View style={styles.modalInputContainer}>
              <Lock size={16} color={theme.colors.textDim} style={styles.inputIcon} />
              <TextInput
                style={styles.modalInput}
                placeholder="Confirm new password"
                placeholderTextColor={theme.colors.textDim}
                secureTextEntry
                value={forgotConfirmPassword}
                onChangeText={setForgotConfirmPassword}
              />
            </View>

            {/* Submit Reset Button */}
            <Button
              title="Reset Password"
              onPress={handleResetPasswordSubmit}
              loading={forgotBusy}
              size="md"
              variant="primary"
              style={{ marginTop: 12, width: '100%' }}
            />
          </View>
        </View>
      </Modal>

      {/* Success Confirmation Modal */}
      <Modal visible={Boolean(successInfo)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                alignItems: 'center',
                paddingVertical: 28,
              },
            ]}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderWidth: 1,
                borderColor: 'rgba(16, 185, 129, 0.4)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Check size={30} color="#10B981" strokeWidth={3} />
            </View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '800',
                color: theme.colors.text,
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              {successInfo?.title}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: theme.colors.textDim,
                textAlign: 'center',
                lineHeight: 19,
                paddingHorizontal: 12,
              }}
            >
              {successInfo?.message}
            </Text>
          </View>
        </View>
      </Modal>
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
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    logoBadge: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: t.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: {
      color: t.colors.text,
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    brandTitle: {
      color: t.colors.accent,
      fontSize: 32,
      fontWeight: '900',
      marginTop: -4,
      letterSpacing: -0.5,
    },
    sub: {
      color: t.colors.textDim,
      marginTop: 8,
      marginBottom: 24,
      fontSize: 14,
      lineHeight: 20,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: t.colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: 4,
      marginBottom: 18,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabText: {
      fontSize: 14,
      fontWeight: '700',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      marginBottom: 12,
      paddingHorizontal: 16,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      color: t.colors.text,
      paddingVertical: 15,
      fontSize: 15,
    },
    forgotBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      marginTop: -4,
      marginBottom: 14,
      paddingVertical: 4,
    },
    forgotText: {
      fontSize: 13,
      fontWeight: '600',
    },
    btn: {
      marginTop: 6,
    },
    switchBtn: {
      alignSelf: 'center',
      marginTop: 18,
      paddingVertical: 6,
    },
    link: {
      color: t.colors.accent,
      fontSize: 13,
      fontWeight: '600',
    },
    securityPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 28,
    },
    securityText: {
      color: t.colors.textDim,
      fontSize: 12,
      fontWeight: '500',
    },
    api: {
      color: t.colors.textDim,
      textAlign: 'center',
      marginTop: 14,
      fontSize: 11,
      opacity: 0.7,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.72)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 24,
      borderWidth: 1,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 10,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
    },
    modalSubtitle: {
      fontSize: 12,
      marginBottom: 16,
      lineHeight: 18,
    },
    modalInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.cardAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      marginBottom: 10,
      paddingHorizontal: 12,
    },
    modalInput: {
      flex: 1,
      color: t.colors.text,
      paddingVertical: 12,
      fontSize: 14,
    },
    smsWrap: {
      flexGrow: 1,
      backgroundColor: t.colors.bg,
      padding: 24,
      justifyContent: 'center',
    },
    smsContainer: {
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
      paddingVertical: 20,
    },
    smsShieldWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: t.colors.accentLight || '#FFF3E0',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    smsH1: {
      color: t.colors.text,
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    smsP: {
      color: t.colors.textDim,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 24,
    },
    smsCard: {
      backgroundColor: t.colors.card,
      borderRadius: 20,
      padding: 18,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    smsCardTitle: {
      color: t.colors.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 12,
    },
    smsLiRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    smsLi: {
      color: t.colors.text,
      fontSize: 13,
      flex: 1,
      lineHeight: 18,
    },
    smsProgText: {
      color: t.colors.textDim,
      fontSize: 13,
      lineHeight: 22,
    },
    smsNote: {
      color: t.colors.textDim,
      fontSize: 11,
      marginTop: 10,
      lineHeight: 16,
      opacity: 0.8,
    },
    smsBtn: {
      marginTop: 6,
      backgroundColor: '#FF5722',
    },
    smsDemoBtn: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    smsSkipWrap: {
      alignSelf: 'center',
      marginTop: 20,
      paddingVertical: 8,
    },
    smsSkip: {
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
