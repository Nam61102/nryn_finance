import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../../services/api';
import { theme, FALLBACK_CATEGORIES } from '../../theme';

export default function CashEntryForm() {
  const [busy, setBusy] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [cashMerchant, setCashMerchant] = useState('');
  const [cashNote, setCashNote] = useState('');
  const [cashCategory, setCashCategory] = useState('food');
  const [cats, setCats] = useState(FALLBACK_CATEGORIES);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = () => {
    api.categories().then((r) => setCats(r.categories)).catch(() => {});
  };

  const saveCashExpense = async () => {
    const val = Number(cashAmount);
    if (!val || val <= 0) return Alert.alert('Enter amount', 'Please enter a valid cash amount.');
    setBusy(true);
    try {
      await api.createCashExpense({
        amount: val,
        merchantName: cashMerchant.trim() || 'Cash Expense',
        note: cashNote.trim() || undefined,
        category: cashCategory,
      });

      Alert.alert('💵 Cash Expense Recorded', `₹${val.toLocaleString('en-IN')} added to your expenses!`, [
        { text: 'View Dashboard', onPress: () => router.replace('/(tabs)') },
        { text: 'Add Another', onPress: () => { setCashAmount(''); setCashMerchant(''); setCashNote(''); } },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.sectionCard}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Add Cash Expense</Text>
        <Text style={styles.cardBadge}>Manual / Cash</Text>
      </View>
      <Text style={styles.cardHint}>
        Record cash purchases that do not send an SMS, or scan physical bills and receipts.
      </Text>

      {/* Amount Row */}
      <View style={styles.amountRow}>
        <Text style={styles.rupee}>₹</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0"
          placeholderTextColor={theme.textDim}
          keyboardType="decimal-pad"
          value={cashAmount}
          onChangeText={setCashAmount}
        />
      </View>

      <TextInput
        style={styles.input}
        placeholder="Where? (Merchant / Store / Person)"
        placeholderTextColor={theme.textDim}
        value={cashMerchant}
        onChangeText={setCashMerchant}
      />
      <TextInput
        style={styles.input}
        placeholder="Note (optional)"
        placeholderTextColor={theme.textDim}
        value={cashNote}
        onChangeText={setCashNote}
      />

      <Text style={styles.fieldLabel}>Category</Text>
      <View style={styles.catGrid}>
        {cats.map((c: any) => {
          const catKey = c.key || c.id;
          const catLabel = c.label || c.name;
          const catIcon = c.icon || c.emoji || '📦';
          return (
            <TouchableOpacity
              key={catKey}
              style={[styles.catChip, cashCategory === catKey && styles.catChipActive]}
              onPress={() => setCashCategory(catKey)}
            >
              <Text style={styles.catEmoji}>{catIcon}</Text>
              <Text style={[styles.catName, cashCategory === catKey && styles.catNameActive]}>
                {catLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={saveCashExpense} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : (
          <Text style={styles.primaryBtnText}>💵 Record Cash Expense</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: theme.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: { color: theme.text, fontSize: 17, fontWeight: '800' },
  cardBadge: {
    backgroundColor: '#F1F5F9',
    color: theme.textDim,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardHint: { color: theme.textDim, fontSize: 12, marginBottom: 14, lineHeight: 17 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  rupee: { color: theme.accent, fontSize: 26, fontWeight: '800', marginRight: 8 },
  amountInput: { flex: 1, color: theme.text, fontSize: 24, fontWeight: '800' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.text,
    fontSize: 14,
    marginBottom: 10,
  },
  fieldLabel: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 6,
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  catChipActive: { backgroundColor: '#FFF7ED', borderColor: theme.accent },
  catEmoji: { fontSize: 14 },
  catName: { color: theme.textDim, fontSize: 11, fontWeight: '600' },
  catNameActive: { color: theme.accent, fontWeight: '800' },
  primaryBtn: {
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
