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
    setBusy(true);
    try {
      const res = mode === 'login' ? await api.login(email.trim(), password) : await api.register(email.trim(), password);
      await setToken(res.token);
      router.replace('/onboarding');
    } catch (e: any) {
      // The single most common setup mistake is EXPO_PUBLIC_API_URL pointing at
      // localhost, which on the phone means the phone itself. Say so plainly.
      Alert.alert('Could not sign in', `${e.message}\n\nAPI: ${API_BASE}\n\nIf this timed out, EXPO_PUBLIC_API_URL must be your computer's LAN IP, and you must restart with: npx expo start -c`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.logo}>NRYN Finance</Text>
      <Text style={styles.sub}>Your spends, read from your own SMS inbox.</Text>

      <TextInput style={styles.input} placeholder="Email" placeholderTextColor={theme.textDim} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password (min 8 chars)" placeholderTextColor={theme.textDim} secureTextEntry value={password} onChangeText={setPassword} />

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
