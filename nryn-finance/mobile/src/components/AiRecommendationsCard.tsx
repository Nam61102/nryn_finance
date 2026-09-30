import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../theme';
import { api } from '../services/api';

export interface Recommendation {
  id: string;
  category: 'spend' | 'loan' | 'insurance' | 'savings' | 'alert';
  tag: string;
  tagColor: string;
  icon: string;
  title: string;
  impact: string;
  explanation: string;
  actionLabel: string;
  actionRoute: string;
}

const FALLBACK_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'rec_food_dining',
    category: 'spend',
    tag: 'SPENDING LEAKAGE',
    tagColor: '#FF6D00',
    icon: '🍔',
    title: 'Food Delivery & Dining Optimization',
    impact: 'Save up to ₹2,400/mo',
    explanation: 'High frequency of weekend delivery orders detected. Setting a weekly dining cap can keep more cash in your wallet.',
    actionLabel: 'Set Food Budget →',
    actionRoute: '/(tabs)/budgets',
  },
  {
    id: 'rec_loan_refinance',
    category: 'loan',
    tag: 'INTEREST SAVER',
    tagColor: '#FF4757',
    icon: '📉',
    title: 'Personal Loan Refinance Advisory',
    impact: 'Save ~₹18,400 in interest',
    explanation: 'Average market rates for balance transfer loans are currently 10.25%. Refinancing high-rate loans will reduce monthly EMI.',
    actionLabel: 'Check Loan Rates →',
    actionRoute: '/add',
  },
  {
    id: 'rec_health_gap',
    category: 'insurance',
    tag: 'PROTECTION GAP',
    tagColor: '#FF4757',
    icon: '🛡️',
    title: 'Critical Health Insurance Missing',
    impact: 'Protect up to ₹10 Lakhs in medical emergencies',
    explanation: 'No health insurance policy found in your vault. Secure your savings against sudden hospital bills with a family cover.',
    actionLabel: 'Upload Health Policy →',
    actionRoute: '/add',
  },
  {
    id: 'rec_emergency_fund',
    category: 'savings',
    tag: 'FINANCIAL SHIELD',
    tagColor: '#10B981',
    icon: '💰',
    title: 'Build 3-Month Emergency Fund',
    impact: 'Target buffer: ₹75,000',
    explanation: 'Keep at least 3 months of basic living expenses in high-yield liquid savings before aggressive investing.',
    actionLabel: 'View Accounts →',
    actionRoute: '/add',
  },
];

export default function AiRecommendationsCard() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>(FALLBACK_RECOMMENDATIONS);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const res = await api.getRecommendations();
      if (res?.recommendations?.length) {
        setRecommendations(res.recommendations);
      }
    } catch {
      // Use fallback recommendations if offline or network unavailable
    } finally {
      setLoading(false);
    }
  };

  const filtered = selectedFilter === 'all'
    ? recommendations
    : recommendations.filter((r) => r.category === selectedFilter);

  const filters = [
    { id: 'all', label: 'All Insights' },
    { id: 'spend', label: '💳 Spends' },
    { id: 'loan', label: '📉 Loans' },
    { id: 'insurance', label: '🛡️ Insurance' },
    { id: 'savings', label: '💰 Savings' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.headerIcon}>✨</Text>
          <View>
            <Text style={styles.headerTitle}>AI Recommendations</Text>
            <Text style={styles.headerSubtitle}>Smart financial advice tailored to you</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.aiBadge} onPress={fetchRecommendations} activeOpacity={0.7}>
          <Text style={styles.aiBadgeText}>{loading ? 'Refreshing...' : 'AI Active'}</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {filters.map((f) => {
          const isActive = selectedFilter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setSelectedFilter(f.id)}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Recommendations Cards Carousel */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={styles.loadingText}>AI analyzing financial patterns...</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsScroll}>
          {filtered.map((rec) => (
            <View key={rec.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.tagPill, { backgroundColor: `${rec.tagColor}15`, borderColor: `${rec.tagColor}35` }]}>
                  <Text style={[styles.tagText, { color: rec.tagColor }]}>{rec.tag}</Text>
                </View>
                <Text style={styles.cardEmoji}>{rec.icon}</Text>
              </View>

              <Text style={styles.cardTitle} numberOfLines={2}>{rec.title}</Text>
              
              <View style={styles.impactBadge}>
                <Text style={styles.impactText}>{rec.impact}</Text>
              </View>

              <Text style={styles.explanationText} numberOfLines={3}>{rec.explanation}</Text>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push(rec.actionRoute as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>{rec.actionLabel}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: theme.textDim,
    fontSize: 11,
    marginTop: 1,
  },
  aiBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  aiBadgeText: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterContent: {
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterChipActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  filterText: {
    color: theme.textDim,
    fontSize: 11,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  loadingText: {
    color: theme.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  cardsScroll: {
    gap: 12,
    paddingBottom: 4,
  },
  card: {
    width: 260,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardEmoji: {
    fontSize: 18,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginBottom: 6,
  },
  impactBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 8,
  },
  impactText: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  explanationText: {
    color: theme.textDim,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  actionBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.accent,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnText: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: '800',
  },
});
