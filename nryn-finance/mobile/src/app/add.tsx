import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { api } from '../services/api';
import { theme, FALLBACK_CATEGORIES } from '../theme';

/**
 * Manual entry (§4A) — cash, splits, anything with no SMS.
 * Without this the monthly total is quietly wrong, which undermines every
 * other number on the home screen.
 */
export default function AddExpense() {
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('food');
  const [cats, setCats] = useState(FALLBACK_CATEGORIES);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.categories().then((r) => setCats(r.categories)).catch(() => {}); }, []);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const save = async (force = false) => {
    const value = Number(amount);
    if (!value || value <= 0) return Alert.alert('Enter an amount');
    setBusy(true);
    try {
      await api.post(`/transactions${force ? '?force=true' : ''}`, {
        amount: value,
        direction: 'debit',
        category,
        merchantName: merchant.trim() || undefined,
        note: note.trim() || undefined,
      });
      goBack();
    } catch (e: any) {
      // The 409 guard: you paid cash, added it, and the UPI SMS arrived 40
      // seconds later for the same spend (§11.11).
      if (e.status === 409) {
        const ex = e.body?.existing;
        Alert.alert(
          'Already recorded?',
          `There is already a ₹${(ex?.amount / 100).toLocaleString('en-IN')} expense${ex?.merchantName ? ` at ${ex.merchantName}` : ''} around this time.`,
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Add anyway', onPress: () => save(true) }],
        );
      } else {
        Alert.alert('Could not save', e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inner}>
        <Text style={styles.h1}>Add expense</Text>

        <View style={styles.amountRow}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            autoFocus
          />
        </View>

        <TextInput style={styles.input} placeholder="Where? (optional)" placeholderTextColor={theme.textDim} value={merchant} onChangeText={setMerchant} />
        <TextInput style={styles.input} placeholder="Note (optional)" placeholderTextColor={theme.textDim} value={note} onChangeText={setNote} />

        <Text style={styles.label}>Category</Text>
        <View style={styles.catGrid}>
          {cats.map((c) => (
            <TouchableOpacity key={c.key} onPress={() => setCategory(c.key)} style={[styles.cat, category === c.key && { backgroundColor: c.color }]}>
              <Text style={{ fontSize: 16 }}>{c.icon}</Text>
              <Text style={[styles.catText, category === c.key && { color: '#0B0F0D', fontWeight: '700' }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={() => save(false)} disabled={busy}>
          <Text style={styles.btnText}>{busy ? 'Saving…' : 'Save expense'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goBack} style={styles.cancelBtn}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: theme.bg, alignItems: 'center', padding: 20, paddingTop: 40, paddingBottom: 40 },
  inner: { width: '100%', maxWidth: 460 },
  h1: { color: theme.text, fontSize: 24, fontWeight: '800', marginBottom: 20 },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10, marginBottom: 14 },
  rupee: { color: theme.textDim, fontSize: 30, fontWeight: '700', marginRight: 6 },
  amountInput: { flex: 1, color: theme.text, fontSize: 36, fontWeight: '800', paddingVertical: 8 },
  input: { backgroundColor: theme.card, color: theme.text, borderRadius: 14, padding: 15, marginBottom: 12, fontSize: 15 },
  label: { color: theme.textDim, marginTop: 10, marginBottom: 10, fontSize: 13 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  catText: { color: theme.textDim, fontSize: 12 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 26 },
  btnText: { color: '#0B0F0D', fontWeight: '800', fontSize: 15 },
  cancelBtn: { padding: 12, alignItems: 'center' },
  cancel: { color: theme.textDim, textAlign: 'center', marginTop: 8 },
});
