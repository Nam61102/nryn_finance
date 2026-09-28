import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { api, setToken, API_BASE } from '../services/api';
import { theme } from '../theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const submit = async () => {
    if (!email.trim()) {
      return Alert.alert('Missing Email', 'Please enter your email address.');
    }
    if (!password) {
      return Alert.alert('Missing Password', 'Please enter your password.');
    }
    setBusy(true);
    try {
      const res = mode === 'login' ? await api.login(email.trim(), password) : await api.register(email.trim(), password);
      await setToken(res.token);
      router.replace('/onboarding');
    } catch (e: any) {
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

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={styles.logo}>NRYN Finance</Text>
      <Text style={styles.sub}>Your spends, read from your own SMS inbox.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={theme.textDim}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 8 chars)"
        placeholderTextColor={theme.textDim}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
        <Text style={styles.btnText}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
        <Text style={styles.link}>{mode === 'login' ? 'No account? Create one' : 'Already have an account? Sign in'}</Text>
      </TouchableOpacity>

      <Text style={styles.api}>API: {API_BASE}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: theme.bg, padding: 24, justifyContent: 'center' },
  logo: { color: theme.text, fontSize: 30, fontWeight: '800' },
  sub: { color: theme.textDim, marginTop: 6, marginBottom: 28 },
  input: { backgroundColor: theme.card, color: theme.text, borderRadius: 14, padding: 15, marginBottom: 12, fontSize: 15 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#0B0F0D', fontWeight: '800', fontSize: 15 },
  link: { color: theme.accent, textAlign: 'center', marginTop: 18 },
  api: { color: theme.textDim, textAlign: 'center', marginTop: 32, fontSize: 11 },
});
