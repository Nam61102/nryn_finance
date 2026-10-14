import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Trash2, AlertTriangle, ShieldCheck } from 'lucide-react-native';
import { api } from '../../services/api';
import { formatINR, formatRelativeIST } from '../../utils/format';
import { FALLBACK_CATEGORIES } from '../../theme';
import { useTheme, makeStyles } from '../../theme';
import { triggerHaptic } from '../../utils/haptics';
import PressableScale from '../../components/ui/PressableScale';

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const styles = useStyles();
  const [txn, setTxn] = useState<any>(null);
  const [cats, setCats] = useState(FALLBACK_CATEGORIES);

  useEffect(() => {
    api.get<any>(`/transactions/${id}`).then((r) => setTxn(r.transaction));
    api.categories().then((r) => setCats(r.categories)).catch(() => {});
  }, [id]);

  if (!txn) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={[styles.loadingText, { color: theme.colors.textDim }]}>Loading transaction details…</Text>
      </View>
    );
  }

  const patch = async (body: any) => {
    triggerHaptic('light');
    const r = await api.patch<any>(`/transactions/${id}`, body);
    setTxn(r.transaction);
  };

  const goBack = () => {
    triggerHaptic('light');
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const handleDelete = () => {
    triggerHaptic('warning');
    Alert.alert(
      'Delete transaction?',
      'It will be removed from your spending and stop counting toward your monthly budget.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            triggerHaptic('error');
            await api.del(`/transactions/${id}`);
            goBack();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PressableScale onPress={goBack} style={styles.backBtn}>
        <ArrowLeft size={20} color={theme.colors.accent} />
        <Text style={styles.backText}>Back</Text>
      </PressableScale>

      <Text style={styles.amount}>{formatINR(txn.amount, { decimals: true })}</Text>
      <Text style={styles.merchant}>{txn.merchantName || txn.merchantRaw || 'Unknown Merchant'}</Text>
      <Text style={styles.meta}>
        {formatRelativeIST(txn.occurredAt)}{' '}
        · {txn.method?.toUpperCase()} · {txn.account?.bankName || 'Bank'}
        {txn.account?.last4 ? ` ••${txn.account.last4}` : ''}
      </Text>

      {txn.needsReview && (
        <View style={styles.reviewBanner}>
          <AlertTriangle size={18} color="#F59E0B" />
          <Text style={styles.reviewText}>
            The parser wasn't confident about this transaction. Please verify the amount and category below.
          </Text>
        </View>
      )}

      <Text style={styles.label}>Category</Text>
      <View style={styles.catGrid}>
        {cats.map((c) => {
          const isSelected = txn.category === c.key;
          return (
            <PressableScale
              key={c.key}
              onPress={() => patch({ category: c.key })}
              style={[
                styles.catPill,
                isSelected && { backgroundColor: c.color },
              ]}
            >
              <Text style={{ fontSize: 14 }}>{c.icon}</Text>
              <Text
                style={[
                  styles.catText,
                  isSelected && { color: '#0B0F0D', fontWeight: '700' },
                ]}
              >
                {c.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <Text style={styles.hint}>
        Changing this category trains the AI rule engine — future charges at {txn.merchantName || 'this merchant'} will be categorized automatically.
      </Text>

      {/* Expense Switch */}
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Counts as an expense</Text>
          <Text style={styles.switchHint}>
            Disable for self-transfers, card bill payments, or investment transfers.
          </Text>
        </View>
        <Switch
          value={txn.isExpense}
          onValueChange={(v) => patch({ isExpense: v })}
          trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
        />
      </View>

      {/* Audit Meta Card */}
      <View style={styles.metaCard}>
        <Row k="Source" v={txn.source} />
        <Row k="Parse Confidence" v={`${Math.round((txn.parseConfidence || 0) * 100)}%`} />
        <Row k="Category Source" v={txn.categorySource} />
        {txn.refId ? <Row k="Reference No" v={txn.refId} /> : null}
        {txn.balanceAfter ? <Row k="Balance After" v={formatINR(txn.balanceAfter)} /> : null}
      </View>

      {/* Delete button */}
      <PressableScale onPress={handleDelete} style={styles.deleteBtn}>
        <Trash2 size={16} color={theme.colors.danger} />
        <Text style={[styles.deleteText, { color: theme.colors.danger }]}>Delete Transaction</Text>
      </PressableScale>
    </ScrollView>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => {
  const theme = useTheme();
  return (
    <View style={stylesRow.row}>
      <Text style={[stylesRow.k, { color: theme.colors.textDim }]}>{k}</Text>
      <Text style={[stylesRow.v, { color: theme.colors.text }]}>{v}</Text>
    </View>
  );
};

const stylesRow = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  k: {
    fontSize: 13,
  },
  v: {
    fontSize: 13,
    fontWeight: '600',
  },
});

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    center: {
      flex: 1,
      backgroundColor: t.colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
    },
    container: {
      flex: 1,
      backgroundColor: t.colors.bg,
    },
    content: {
      padding: 16,
      paddingTop: 44,
      paddingBottom: 48,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 16,
      alignSelf: 'flex-start',
    },
    backText: {
      color: t.colors.accent,
      fontSize: 15,
      fontWeight: '600',
    },
    amount: {
      color: t.colors.text,
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    merchant: {
      color: t.colors.text,
      fontSize: 18,
      marginTop: 6,
      fontWeight: '700',
    },
    meta: {
      color: t.colors.textDim,
      fontSize: 12,
      marginTop: 4,
    },
    reviewBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderRadius: 14,
      padding: 12,
      marginTop: 16,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    reviewText: {
      color: '#F59E0B',
      fontSize: 12,
      lineHeight: 18,
      flex: 1,
    },
    label: {
      color: t.colors.textDim,
      marginTop: 24,
      marginBottom: 10,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    catGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    catPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: t.colors.card,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    catText: {
      color: t.colors.textDim,
      fontSize: 12,
      fontWeight: '600',
    },
    hint: {
      color: t.colors.textDim,
      fontSize: 11,
      marginTop: 10,
      lineHeight: 16,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.card,
      borderRadius: 16,
      padding: 16,
      marginTop: 20,
      borderWidth: 1,
      borderColor: t.colors.border,
      gap: 12,
    },
    switchLabel: {
      color: t.colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    switchHint: {
      color: t.colors.textDim,
      fontSize: 11,
      marginTop: 4,
      lineHeight: 16,
    },
    metaCard: {
      backgroundColor: t.colors.card,
      borderRadius: 16,
      padding: 16,
      marginTop: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      marginTop: 16,
      borderRadius: 16,
      backgroundColor: 'rgba(255, 71, 87, 0.08)',
    },
    deleteText: {
      fontSize: 14,
      fontWeight: '700',
    },
  })
);
