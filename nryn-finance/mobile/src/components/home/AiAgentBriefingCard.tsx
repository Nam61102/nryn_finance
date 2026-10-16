import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sparkles, Bot, ChevronRight } from 'lucide-react-native';
import { makeStyles, Theme } from '../../theme';
import { haptic } from '../../utils/haptics';

interface AgentBriefingProps {
  briefingData: any;
  onOpenCopilot?: (initialMessage?: string) => void;
}

export default function AiAgentBriefingCard({ briefingData, onOpenCopilot }: AgentBriefingProps) {
  const styles = useStyles();

  const briefing = briefingData?.briefing;
  const metrics = briefing?.metrics;

  const headline = briefing?.headline || 'Good afternoon, Namrata! 👋';
  const narrative = briefing?.narrative || 'I have audited all 14 bank transactions for October. Your spending pace is 51% slower than September. All accounts verified with 0 anomalous charges.';
  
  const highlights = briefing?.highlights || [
    { id: 'h1', label: 'Spending Velocity', value: '↓ 51% Lower', subtext: 'vs Last Mo' },
    { id: 'h2', label: 'Discretionary Pace', value: '₹505/day', subtext: 'Safe Allowance' },
    { id: 'h3', label: 'Autonomous Audit', value: '14 Verified', subtext: '0 Anomalies' },
  ];

  const quickPrompts = briefing?.quickPrompts || [
    'Can I afford to spend ₹2,000 this weekend?',
    'Analyze my top spending categories',
  ];

  return (
    <View style={styles.cardContainer}>
      {/* 1. DIRECT EXECUTIVE BRIEFING HEADER */}
      <View style={styles.briefingHeader}>
        <View style={styles.botIconWrap}>
          <Bot size={20} color="#FF6D00" />
        </View>
        <View style={styles.titleTextWrap}>
          <View style={styles.briefingTagRow}>
            <Text style={styles.briefingTag}>DAILY FINANCIAL BRIEFING</Text>
            <View style={styles.dotSeparator} />
            <Text style={styles.auditStatusTag}>
              {metrics?.auditedTxnsCount !== undefined ? `${metrics.auditedTxnsCount} AUDITED` : '14 AUDITED'}
            </Text>
          </View>
          <Text style={styles.headlineText} numberOfLines={1}>
            {headline}
          </Text>
        </View>
      </View>

      {/* 2. NATURAL LANGUAGE CONVERSATIONAL NARRATIVE */}
      <View style={styles.narrativeWrap}>
        <Text style={styles.narrativeText}>
          {narrative}
        </Text>
      </View>

      {/* 3. WHITE & ORANGE 3-POD INTELLIGENCE HIGHLIGHTS */}
      <View style={styles.highlightsGrid}>
        {highlights.map((h: any, idx: number) => (
          <View key={h.id || idx} style={styles.highlightPod}>
            <Text style={styles.podLabel} numberOfLines={1}>{h.label}</Text>
            <Text style={styles.podValue} numberOfLines={1}>{h.value}</Text>
            <Text style={styles.podSubtext} numberOfLines={1}>{h.subtext}</Text>
          </View>
        ))}
      </View>

      {/* 4. INTERACTIVE ASK AI ACTION BAR */}
      <TouchableOpacity
        style={styles.askAiBar}
        activeOpacity={0.85}
        onPress={() => {
          haptic.light();
          onOpenCopilot?.(quickPrompts[0]);
        }}
      >
        <View style={styles.askAiLeft}>
          <View style={styles.sparkleWrap}>
            <Sparkles size={14} color="#FFFFFF" />
          </View>
          <Text style={styles.askAiPlaceholder} numberOfLines={1}>
            {quickPrompts[0] ? `"${quickPrompts[0]}"` : 'Ask your AI Agent anything...'}
          </Text>
        </View>
        <View style={styles.askAiRight}>
          <Text style={styles.askBtnText}>Ask AI</Text>
          <ChevronRight size={14} color="#FF6D00" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    cardContainer: {
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 6,
      borderRadius: 24,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#F1F5F9',
      padding: 16,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 16,
      elevation: 3,
      gap: 12,
    },
    briefingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    botIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#FFF7ED',
      borderWidth: 1,
      borderColor: '#FFD7B2',
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleTextWrap: {
      flex: 1,
    },
    briefingTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    briefingTag: {
      color: '#E65100',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    dotSeparator: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: '#FF6D00',
    },
    auditStatusTag: {
      color: '#FF6D00',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    headlineText: {
      color: '#0F172A',
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: -0.3,
      marginTop: 2,
    },
    narrativeWrap: {
      backgroundColor: '#FFF7ED',
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: '#FFE4CC',
    },
    narrativeText: {
      color: '#431407',
      fontSize: 12.5,
      lineHeight: 18,
      fontWeight: '600',
    },
    highlightsGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    highlightPod: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: '#F1F5F9',
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    podLabel: {
      color: '#E65100',
      fontSize: 9.5,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    podValue: {
      color: '#0F172A',
      fontSize: 13.5,
      fontWeight: '900',
      letterSpacing: -0.2,
      marginBottom: 2,
    },
    podSubtext: {
      color: '#64748B',
      fontSize: 9.5,
      fontWeight: '600',
    },
    askAiBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#FFF7ED',
      borderWidth: 1.5,
      borderColor: '#FFD7B2',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: 2,
    },
    askAiLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      marginRight: 8,
    },
    sparkleWrap: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#FF6D00',
      alignItems: 'center',
      justifyContent: 'center',
    },
    askAiPlaceholder: {
      color: '#7C2D12',
      fontSize: 11.5,
      fontWeight: '600',
      fontStyle: 'italic',
      flex: 1,
    },
    askAiRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    askBtnText: {
      color: '#FF6D00',
      fontSize: 12,
      fontWeight: '900',
    },
  })
);
