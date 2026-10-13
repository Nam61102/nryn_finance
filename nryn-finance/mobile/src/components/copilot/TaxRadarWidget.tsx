import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FileText, CheckCircle2, ArrowRight } from 'lucide-react-native';
import { useTheme, makeStyles, Theme } from '../../theme';
import { api } from '../../services/api';
import { haptic } from '../../utils/haptics';

export default function TaxRadarWidget() {
  const theme = useTheme();
  const styles = useStyles();
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const fetchTaxRadar = () => {
    api.getTaxRadar().then(setData).catch(() => {});
  };

  useEffect(() => {
    fetchTaxRadar();
  }, []);

  const handleSelectRegime = async (regime: 'new' | 'old') => {
    haptic.medium();
    setSaving(true);
    try {
      await api.setTaxRegime(regime);
      await fetchTaxRadar();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (!data) return null;

  const fyLabel = data.financialYearLabel || `FY ${data.financialYear || '2026-27'}`;

  // 1. Regime Unknown State
  if (data.regimeUnknown) {
    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.titleGroup}>
            <FileText size={18} color={theme.accent} />
            <Text style={styles.title}>80C & 80D Tax Radar</Text>
          </View>
          <Text style={styles.badge}>{fyLabel}</Text>
        </View>

        <Text style={styles.subtitle}>
          Select your tax regime to see applicable Section 80C and 80D deductions.
        </Text>

        <View style={styles.regimePickerRow}>
          <TouchableOpacity
            style={[styles.regimeBtn, styles.regimeBtnNew]}
            onPress={() => handleSelectRegime('new')}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.regimeBtnTitleNew}>New Regime (Default)</Text>
                <Text style={styles.regimeBtnSubNew}>Lower slab rates · No 80C/80D</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.regimeBtn, styles.regimeBtnOld]}
            onPress={() => handleSelectRegime('old')}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <>
                <Text style={styles.regimeBtnTitleOld}>Old Regime</Text>
                <Text style={styles.regimeBtnSubOld}>Claim ₹1.5L 80C + ₹25k 80D</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 2. New Regime State
  if (data.taxRegime === 'new' || data.notApplicable) {
    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.titleGroup}>
            <FileText size={18} color={theme.accent} />
            <Text style={styles.title}>Tax Radar (New Regime)</Text>
          </View>
          <View style={styles.regimeTag}>
            <Text style={styles.regimeTagText}>NEW REGIME</Text>
          </View>
        </View>

        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerTitle}>Section 80C & 80D Exemptions Do Not Apply</Text>
          <Text style={styles.infoBannerText}>
            Under the New Tax Regime, you benefit from lower slab rates and a higher rebate limit (up to ₹7 Lakhs). Chapter VI-A deductions (80C, 80D) cannot be claimed.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.switchRegimeBtn}
          onPress={() => handleSelectRegime('old')}
          disabled={saving}
          activeOpacity={0.7}
        >
          <Text style={styles.switchRegimeText}>Switch to Old Regime for 80C/80D</Text>
          <ArrowRight size={13} color={theme.accent} />
        </TouchableOpacity>
      </View>
    );
  }

  // 3. Old Regime Empty State
  if (data.empty) {
    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.titleGroup}>
            <FileText size={18} color={theme.accent} />
            <Text style={styles.title}>Tax Radar ({fyLabel})</Text>
          </View>
          <Text style={styles.badge}>Old Regime</Text>
        </View>
        <Text style={styles.emptyText}>
          No tax-saving investments found yet. Add your ELSS, PPF, or Insurance policies above to calculate your Section 80C (up to ₹1.5L) and Section 80D (up to ₹25k) deductions.
        </Text>
      </View>
    );
  }

  // 4. Old Regime with Real Data
  const s80C = data.section80C || {};
  const s80D = data.section80D || {};

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <FileText size={18} color={theme.accent} />
          <Text style={styles.title}>Tax Deductions ({fyLabel})</Text>
        </View>
        <Text style={styles.badge}>Old Regime</Text>
      </View>

      {/* 80C Gauge */}
      <View style={styles.sectionBlock}>
        <View style={styles.blockHeader}>
          <Text style={styles.blockTitle}>Section 80C (ELSS, PF, Life)</Text>
          <Text style={styles.blockMetric}>
            ₹{(s80C.utilizedINR || 0).toLocaleString('en-IN')} / ₹1,50,000
          </Text>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.min(100, s80C.percentage || 0)}%`, backgroundColor: theme.accent },
            ]}
          />
        </View>
        <Text style={styles.remainingText}>
          ₹{(s80C.remainingINR || 0).toLocaleString('en-IN')} remaining limit
        </Text>
      </View>

      {/* 80D Gauge */}
      <View style={styles.sectionBlock}>
        <View style={styles.blockHeader}>
          <Text style={styles.blockTitle}>Section 80D (Health Insurance)</Text>
          <Text style={styles.blockMetric}>
            ₹{(s80D.utilizedINR || 0).toLocaleString('en-IN')} / ₹25,000
          </Text>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.min(100, s80D.percentage || 0)}%`, backgroundColor: theme.success },
            ]}
          />
        </View>
        <Text style={styles.remainingText}>
          ₹{(s80D.remainingINR || 0).toLocaleString('en-IN')} remaining limit
        </Text>
      </View>

      {data.actionableTip && (
        <View style={styles.tipBox}>
          <Text style={styles.tipText}>💡 {data.actionableTip}</Text>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.card,
      borderRadius: t.radius.lg,
      marginTop: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
      ...t.shadows.sm,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { color: t.text, fontSize: 15, fontWeight: '800' },
    badge: {
      color: t.accent,
      backgroundColor: t.accentLight,
      borderWidth: 1,
      borderColor: t.accentBorder,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      fontSize: 10,
      fontWeight: '800',
    },
    subtitle: {
      color: t.textDim,
      fontSize: 12,
      marginBottom: 14,
      lineHeight: 17,
    },
    emptyText: {
      color: t.textDim,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
    },
    regimePickerRow: {
      flexDirection: 'row',
      gap: 10,
    },
    regimeBtn: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: t.radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    regimeBtnNew: {
      backgroundColor: t.accent,
    },
    regimeBtnTitleNew: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },
    regimeBtnSubNew: {
      color: 'rgba(255, 255, 255, 0.85)',
      fontSize: 10,
      marginTop: 2,
      textAlign: 'center',
    },
    regimeBtnOld: {
      backgroundColor: t.cardAlt,
      borderWidth: 1,
      borderColor: t.border,
    },
    regimeBtnTitleOld: {
      color: t.text,
      fontSize: 12,
      fontWeight: '800',
    },
    regimeBtnSubOld: {
      color: t.textDim,
      fontSize: 10,
      marginTop: 2,
      textAlign: 'center',
    },
    regimeTag: {
      backgroundColor: t.cardAlt,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    regimeTagText: {
      color: t.textDim,
      fontSize: 10,
      fontWeight: '800',
    },
    infoBanner: {
      backgroundColor: t.cardAlt,
      borderRadius: t.radius.sm,
      padding: 12,
      borderLeftWidth: 3,
      borderLeftColor: t.accent,
      marginVertical: 8,
    },
    infoBannerTitle: {
      color: t.text,
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 3,
    },
    infoBannerText: {
      color: t.textDim,
      fontSize: 11,
      lineHeight: 16,
    },
    switchRegimeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 8,
      alignSelf: 'flex-start',
    },
    switchRegimeText: {
      color: t.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    sectionBlock: {
      marginTop: 12,
    },
    blockHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    blockTitle: {
      color: t.text,
      fontSize: 12,
      fontWeight: '700',
    },
    blockMetric: {
      color: t.text,
      fontSize: 12,
      fontWeight: '800',
    },
    track: {
      height: 6,
      backgroundColor: t.cardAlt,
      borderRadius: 3,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
    },
    remainingText: {
      color: t.textDim,
      fontSize: 10,
      marginTop: 4,
    },
    tipBox: {
      marginTop: 14,
      padding: 10,
      backgroundColor: t.cardAlt,
      borderRadius: 8,
    },
    tipText: {
      color: t.textDim,
      fontSize: 11,
      lineHeight: 16,
    },
  })
);
