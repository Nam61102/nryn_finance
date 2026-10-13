import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Mail, Lock, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react-native';
import { api, setToken, API_BASE } from '../services/api';
import { useTheme, makeStyles } from '../theme';
import { triggerHaptic } from '../utils/haptics';
import PressableScale from '../components/ui/PressableScale';
import Button from '../components/ui/Button';

export default function Login() {
  const theme = useTheme();
  const styles = useStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const submit = async () => {
    if (!email.trim()) {
      triggerHaptic('warning');
      return Alert.alert('Missing Email', 'Please enter your email address.');
    }
    if (!password) {
      triggerHaptic('warning');
      return Alert.alert('Missing Password', 'Please enter your password.');
    }
    triggerHaptic('medium');
    setBusy(true);
    try {
      const res =
        mode === 'login'
          ? await api.login(email.trim(), password)
          : await api.register(email.trim(), password);
      await setToken(res.token);
      triggerHaptic('success');
      router.replace('/onboarding');
    } catch (e: any) {
      triggerHaptic('error');
      const errMsg = e.body?.error || e.message || '';
      if (errMsg.includes('email_taken') || e.status === 409) {
        Alert.alert(
          'Account Already Exists',
          'This email is already registered. Switched to Sign In mode — please enter your password and tap Sign in.',
          [{ text: 'OK' }]
        );
        setMode('login');
      } else if (errMsg.includes('invalid_credentials') || e.status === 401) {
        Alert.alert('Sign In Failed', 'Incorrect email or password. Please check your details and try again.');
      } else if (errMsg.includes('email_and_8char_password_required') || e.status === 400) {
        Alert.alert('Password Too Short', 'Password must be at least 8 characters long.');
      } else {
        Alert.alert('Could Not Connect', `${errMsg}\n\nAPI: ${API_BASE}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleMode = () => {
    triggerHaptic('selection');
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <View style={styles.brandRow}>
        <View style={styles.logoBadge}>
          <Sparkles size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.logo}>NRYN</Text>
      </View>
      <Text style={styles.brandTitle}>Finance</Text>
      <Text style={styles.sub}>
        Your spends, read from your own SMS inbox. 100% private and on-device.
      </Text>

      {/* Inputs */}
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
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      {/* Submit Button */}
      <Button
        title={mode === 'login' ? 'Sign In' : 'Create Account'}
        onPress={submit}
        loading={busy}
        size="lg"
        variant="primary"
        icon={<ArrowRight size={18} color="#0B0F0D" />}
        style={styles.btn}
      />

      {/* Switch Mode Link */}
      <PressableScale onPress={toggleMode} style={styles.switchBtn}>
        <Text style={styles.link}>
          {mode === 'login'
            ? "Don't have an account? Create one"
            : 'Already have an account? Sign in'}
        </Text>
      </PressableScale>

      <View style={styles.securityPill}>
        <ShieldCheck size={14} color="#10B981" />
        <Text style={styles.securityText}>AES encrypted · On-device parsing</Text>
      </View>

      <Text style={styles.api}>API: {API_BASE}</Text>
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
      marginBottom: 32,
      fontSize: 14,
      lineHeight: 20,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      marginBottom: 14,
      paddingHorizontal: 16,
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      color: t.colors.text,
      paddingVertical: 16,
      fontSize: 15,
    },
    btn: {
      marginTop: 10,
    },
    switchBtn: {
      alignSelf: 'center',
      marginTop: 20,
      paddingVertical: 6,
    },
    link: {
      color: t.colors.accent,
      fontSize: 14,
      fontWeight: '700',
    },
    securityPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 32,
    },
    securityText: {
      color: t.colors.textDim,
      fontSize: 12,
      fontWeight: '500',
    },
    api: {
      color: t.colors.textDim,
      textAlign: 'center',
      marginTop: 16,
      fontSize: 11,
      opacity: 0.7,
    },
  })
);
