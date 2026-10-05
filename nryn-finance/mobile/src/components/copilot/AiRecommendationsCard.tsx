import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';

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
}

export default function AiRecommendationsCard({ data, onAskCopilot }: AiRecommendationsCardProps) {
  if (!data || !data.recommendations || data.recommendations.length === 0) {
    return null;
  }

  const { totalPotentialSavingsINR, recommendations } = data;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.icon}>✨</Text>
          <View>
            <Text style={styles.title}>AI Spending Recommendations</Text>
            <Text style={styles.subtitle}>खर्चाचे विश्लेषण आणि बचत टिप्स</Text>
          </View>
        </View>
        {totalPotentialSavingsINR && totalPotentialSavingsINR > 0 ? (
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsBadgeText}>
              Save ~₹{totalPotentialSavingsINR.toLocaleString('en-IN')}/mo
            </Text>
          </View>
        ) : null}
      </View>

      {/* Recommendations List */}
      <View style={styles.list}>
        {recommendations.map((rec) => {
          const isHigh = rec.severity === 'high';
          const badgeBg = isHigh ? '#FEF2F2' : '#FFF7ED';
          const badgeBorder = isHigh ? '#FECACA' : '#FFEDD5';
          const badgeColor = isHigh ? '#EF4444' : '#F97316';

          return (
            <View key={rec.id} style={styles.itemCard}>
              {/* Item Top Row */}
              <View style={styles.itemHeader}>
                <View style={styles.merchantLeft}>
                  <View style={styles.iconBox}>
                    <Text style={styles.itemIcon}>{rec.icon || '🛍️'}</Text>
                  </View>
                  <View style={styles.merchantDetails}>
                    <Text style={styles.merchantName}>{rec.merchantName || rec.title}</Text>
                    <Text style={styles.comparisonText}>
                      {rec.comparisonText || `${rec.orderCount || 0} orders recorded`}
                    </Text>
                  </View>
                </View>

                <View style={[styles.severityBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
                  <Text style={[styles.severityText, { color: badgeColor }]}>
                    {isHigh ? 'High Spend' : 'Optimize'}
                  </Text>
                </View>
              </View>

              {/* Amount Breakdown */}
              <View style={styles.statRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Total Spend</Text>
                  <Text style={styles.statValue}>₹{rec.totalSpentINR.toLocaleString('en-IN')}</Text>
                </View>
                {rec.percentOfTotal !== undefined && rec.percentOfTotal > 0 && (
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>Share of Budget</Text>
                    <Text style={[styles.statValue, { color: theme.accent }]}>
                      {rec.percentOfTotal}%
                    </Text>
                  </View>
                )}
                {rec.potentialSavingsINR > 0 && (
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>Target Savings</Text>
                    <Text style={[styles.statValue, { color: '#10B981' }]}>
                      +₹{rec.potentialSavingsINR.toLocaleString('en-IN')}
                    </Text>
                  </View>
                )}
              </View>

              {/* AI Suggestion Box */}
              <View style={styles.aiSuggestionBox}>
                <View style={styles.aiLabelRow}>
                  <Text style={styles.aiLabel}>💡 AI Smart Advice</Text>
                </View>
                <Text style={styles.aiText}>{rec.aiSuggestion}</Text>
              </View>

              {/* Action Button */}
              {onAskCopilot && rec.merchantName && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    onAskCopilot(
                      `How can I reduce my spending on ${rec.merchantName}? Give me a weekly meal/spending plan.`
                    )
                  }
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>
                    Ask Copilot for Plan on {rec.merchantName} →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
  subtitle: {
    fontSize: 11,
    color: theme.textDim,
    marginTop: 1,
  },
  savingsBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  savingsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  list: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  merchantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemIcon: {
    fontSize: 20,
  },
  merchantDetails: {
    flex: 1,
  },
  merchantName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  comparisonText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statCol: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
  aiSuggestionBox: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    padding: 10,
  },
  aiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiText: {
    fontSize: 12,
    color: '#7C2D12',
    lineHeight: 18,
  },
  actionBtn: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDBA74',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.accent,
  },
});
