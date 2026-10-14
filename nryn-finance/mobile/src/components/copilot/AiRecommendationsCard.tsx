import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sparkles, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react-native';
import { useTheme, makeStyles, Theme } from '../../theme';
import { haptic } from '../../utils/haptics';
import { formatNumberINR } from '../../utils/format';

export interface RecommendationItem {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'info';
  icon: string;
  merchantName?: string;
  category?: string;
  totalSpentINR: number;
  orderCount?: number;
  percentOfTotal?: number;
  comparisonText?: string;
  title: string;
  reason: string;
  aiSuggestion: string;
  potentialSavingsINR: number;
  actionTag: string;
}

interface AiRecommendationsCardProps {
  data: {
    ok: boolean;
    month?: string;
    totalSpentINR?: number;
    totalPotentialSavingsINR?: number;
    recommendations: RecommendationItem[];
  } | null;
  onAskCopilot?: (prompt: string) => void;
  maxInitial?: number;
}

export default function AiRecommendationsCard({
  data,
  maxInitial = 2,
}: AiRecommendationsCardProps) {
  const theme = useTheme();
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);

  if (!data) return null;

  const totalPotentialSavingsINR = Number(data?.totalPotentialSavingsINR) || 0;
  const recommendations = Array.isArray(data?.recommendations) ? data.recommendations : [];

  if (recommendations.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <Sparkles size={18} color={theme.accent} />
            <View>
              <Text style={styles.title}>AI Spending Recommendations</Text>
              <Text style={styles.subtitle}>Smart spend analysis & savings tips</Text>
            </View>
          </View>
        </View>

        <View style={styles.balancedCard}>
          <Lightbulb size={20} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.balancedTitle}>Insights appear after a few days of spending</Text>
            <Text style={styles.balancedText}>
              Keep tracking your expenses. AI will automatically identify merchant patterns, duplicate charges, and potential savings.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const displayed = expanded ? recommendations : recommendations.slice(0, maxInitial);

  const toggleExpand = () => {
    haptic.light();
    setExpanded(!expanded);
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Sparkles size={18} color={theme.accent} />
          <View>
            <Text style={styles.title}>AI Spending Recommendations</Text>
            <Text style={styles.subtitle}>Smart spend analysis & savings tips</Text>
          </View>
        </View>
        {totalPotentialSavingsINR > 0 ? (
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsBadgeText}>
              Save ~₹{formatNumberINR(totalPotentialSavingsINR)}/mo
            </Text>
          </View>
        ) : null}
      </View>

      {/* Recommendations List */}
      <View style={styles.list}>
        {displayed.map((rec, idx) => {
          const isHigh = rec.severity === 'high';

          return (
            <View key={rec.id || `rec-${idx}`} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.merchantLeft}>
                  <View style={styles.iconBox}>
                    <Text style={styles.itemIcon}>{rec.icon || '🛍️'}</Text>
                  </View>
                  <View style={styles.merchantDetails}>
                    <Text style={styles.merchantName}>{rec.merchantName || rec.title || 'Spend'}</Text>
                    <Text style={styles.comparisonText}>
                      {rec.comparisonText || `${rec.orderCount || 0} orders recorded`}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.severityBadge,
                    {
                      backgroundColor: isHigh ? theme.dangerLight : theme.accentLight,
                      borderColor: isHigh ? theme.dangerBorder : theme.accentBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.severityText,
                      { color: isHigh ? theme.danger : theme.accent },
                    ]}
                  >
                    {isHigh ? 'High Spend' : 'Optimize'}
                  </Text>
                </View>
              </View>

              {/* Amount Breakdown */}
              <View style={styles.statRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Total Spend</Text>
                  <Text style={styles.statValue}>₹{formatNumberINR(rec.totalSpentINR)}</Text>
                </View>
                {rec.percentOfTotal !== undefined && rec.percentOfTotal > 0 && (
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>Share</Text>
                    <Text style={[styles.statValue, { color: theme.accent }]}>
                      {rec.percentOfTotal}%
                    </Text>
                  </View>
                )}
                {rec.potentialSavingsINR > 0 && (
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>Target Savings</Text>
                    <Text style={[styles.statValue, { color: theme.success }]}>
                      ~₹{formatNumberINR(rec.potentialSavingsINR)}
                    </Text>
                  </View>
                )}
              </View>

              {/* AI Insight Box */}
              {rec.aiSuggestion ? (
                <View style={styles.aiBox}>
                  <Text style={styles.aiBoxText}>{rec.aiSuggestion}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {recommendations.length > maxInitial && (
        <TouchableOpacity style={styles.expandBtn} onPress={toggleExpand} activeOpacity={0.7}>
          <Text style={styles.expandBtnText}>
            {expanded ? 'Show Less' : `See All (${recommendations.length})`}
          </Text>
          {expanded ? <ChevronUp size={14} color={theme.accent} /> : <ChevronDown size={14} color={theme.accent} />}
        </TouchableOpacity>
      )}
    </View>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.card,
      borderRadius: t.radius.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
      ...t.shadows.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    title: { color: t.text, fontSize: 15, fontWeight: '800' },
    subtitle: { color: t.textDim, fontSize: 11, marginTop: 1 },
    savingsBadge: {
      backgroundColor: t.successLight,
      borderWidth: 1,
      borderColor: t.successBorder,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    savingsBadgeText: { color: t.success, fontSize: 11, fontWeight: '800' },
    balancedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: t.cardAlt,
      borderRadius: t.radius.sm,
      padding: 14,
      marginTop: 4,
    },
    balancedTitle: { color: t.text, fontSize: 13, fontWeight: '700' },
    balancedText: { color: t.textDim, fontSize: 12, marginTop: 2, lineHeight: 17 },
    list: { gap: 10 },
    itemCard: {
      backgroundColor: t.cardAlt,
      borderRadius: t.radius.sm,
      padding: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    merchantLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    iconBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: t.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
    },
    itemIcon: { fontSize: 16 },
    merchantDetails: { flex: 1 },
    merchantName: { color: t.text, fontSize: 13, fontWeight: '800' },
    comparisonText: { color: t.textDim, fontSize: 11, marginTop: 1 },
    severityBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
    },
    severityText: { fontSize: 10, fontWeight: '800' },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: t.card,
      borderRadius: 8,
      padding: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: t.border,
    },
    statCol: { alignItems: 'center', flex: 1 },
    statLabel: { color: t.textDim, fontSize: 10, fontWeight: '600' },
    statValue: { color: t.text, fontSize: 13, fontWeight: '800', marginTop: 1 },
    aiBox: {
      backgroundColor: t.card,
      borderRadius: 8,
      padding: 8,
      borderLeftWidth: 3,
      borderLeftColor: t.accent,
    },
    aiBoxText: { color: t.text, fontSize: 11, lineHeight: 16 },
    expandBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 12,
      paddingVertical: 6,
    },
    expandBtnText: { color: t.accent, fontSize: 12, fontWeight: '700' },
  })
);
