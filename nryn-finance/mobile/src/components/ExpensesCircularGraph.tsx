import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../theme';
import { formatINR } from '../services/api';

export type SortKey = 'amount_desc' | 'amount_asc' | 'date_desc' | 'date_asc';

export interface SortOption {
  key: SortKey;
  label: string;
  marathiLabel: string;
  icon: string;
  color: string;
  sublabel: string;
}

export const SORT_OPTIONS: SortOption[] = [
  {
    key: 'amount_desc',
    label: 'Highest',
    marathiLabel: 'खर्च जास्त',
    icon: '💎',
    color: '#00E676', // Emerald Green
    sublabel: 'Max spend',
  },
  {
    key: 'date_desc',
    label: 'Newest',
    marathiLabel: 'नवीन',
    icon: '⚡',
    color: '#B388FF', // Vibrant Violet
    sublabel: 'Latest first',
  },
  {
    key: 'amount_asc',
    label: 'Lowest',
    marathiLabel: 'खर्च कमी',
    icon: '🪙',
    color: '#00E5FF', // Cyan / Electric Blue
    sublabel: 'Min spend',
  },
  {
    key: 'date_asc',
    label: 'Oldest',
    marathiLabel: 'जुने',
    icon: '⏳',
    color: '#FFB300', // Amber Gold
    sublabel: 'Earliest first',
  },
];

interface Props {
  currentSort: string;
  onSelectSort: (key: string) => void;
  txns: any[];
  totalCount?: number;
}

export default function ExpensesCircularGraph({ currentSort, onSelectSort, txns }: Props) {
  const size = 168;
  const strokeWidth = 11;
  const activeStrokeWidth = 16;
  const radius = (size - 24) / 2;
  const circumference = 2 * Math.PI * radius;
  const segmentSpan = circumference / 4;
  const gap = 10;
  const arcLength = segmentSpan - gap;

  // Calculate highest and lowest values from currently loaded expenses
  const expenseAmounts = txns.filter((t) => t.amount > 0).map((t) => t.amount);
  const maxPaise = expenseAmounts.length > 0 ? Math.max(...expenseAmounts) : 0;
  const minPaise = expenseAmounts.length > 0 ? Math.min(...expenseAmounts) : 0;

  const activeOption = SORT_OPTIONS.find((s) => s.key === currentSort) || SORT_OPTIONS[0];

  const getStatForOption = (key: SortKey) => {
    switch (key) {
      case 'amount_desc':
        return maxPaise > 0 ? `Max ${formatINR(maxPaise)}` : 'Top spend';
      case 'amount_asc':
        return minPaise > 0 ? `Min ${formatINR(minPaise)}` : 'Low spend';
      case 'date_desc':
        return 'Latest date';
      case 'date_asc':
        return 'Earliest date';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerIcon}>⭕</Text>
          <Text style={styles.headerTitle}>Expense Explorer Wheel</Text>
        </View>
        <View style={[styles.activeBadge, { borderColor: `${activeOption.color}40`, backgroundColor: `${activeOption.color}15` }]}>
          <Text style={[styles.activeBadgeText, { color: activeOption.color }]}>
            {activeOption.icon} {activeOption.label}
          </Text>
        </View>
      </View>

      <Text style={styles.subHint}>
        Touch any segment or quadrant to see those expenses:
      </Text>

      {/* Circular Wheel Center Graphic */}
      <View style={styles.wheelWrapper}>
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
            {SORT_OPTIONS.map((opt, index) => {
              const isActive = opt.key === currentSort;
              const stroke = isActive ? activeStrokeWidth : strokeWidth;
              const offset = - (index * segmentSpan);
              return (
                <Circle
                  key={opt.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={opt.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${arcLength} ${circumference - arcLength}`}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  fill="none"
                  opacity={isActive ? 1 : 0.3}
                  onPress={() => onSelectSort(opt.key)}
                />
              );
            })}
          </Svg>

          {/* Center Info in the Wheel */}
          <View style={styles.wheelCenterContent} pointerEvents="none">
            <Text style={styles.centerIcon}>{activeOption.icon}</Text>
            <Text style={[styles.centerTitle, { color: activeOption.color }]}>{activeOption.label}</Text>
            <Text style={styles.centerStat}>{getStatForOption(activeOption.key)}</Text>
            <Text style={styles.centerActionHint}>Touch to filter</Text>
          </View>
        </View>
      </View>

      {/* 4 Interactive Quadrant Touch Cards (2x2 Grid) */}
      <View style={styles.grid}>
        {SORT_OPTIONS.map((opt) => {
          const isActive = opt.key === currentSort;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.quadrantCard,
                isActive && {
                  borderColor: opt.color,
                  backgroundColor: `${opt.color}18`,
                  shadowColor: opt.color,
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 3,
                },
              ]}
              onPress={() => onSelectSort(opt.key)}
              activeOpacity={0.7}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.cardIcon}>{opt.icon}</Text>
                <View
                  style={[
                    styles.indicatorDot,
                    { backgroundColor: isActive ? opt.color : `${opt.color}40` },
                  ]}
                />
              </View>

              <Text style={[styles.cardLabel, isActive && { color: theme.text, fontWeight: '800' }]}>
                {opt.label}
              </Text>
              <Text style={styles.cardMarathiLabel}>{opt.marathiLabel}</Text>
              <Text style={[styles.cardSublabel, isActive && { color: opt.color }]}>
                {getStatForOption(opt.key)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Active Filter Summary Bar */}
      <View style={[styles.summaryBar, { borderColor: `${activeOption.color}30`, backgroundColor: `${activeOption.color}0D` }]}>
        <View style={[styles.summaryBullet, { backgroundColor: activeOption.color }]} />
        <Text style={styles.summaryText}>
          Showing <Text style={{ color: activeOption.color, fontWeight: '700' }}>{activeOption.label}</Text> ({activeOption.marathiLabel}) expenses below:
        </Text>
      </View>
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
  },
  activeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  subHint: {
    color: theme.textDim,
    fontSize: 12,
    marginBottom: 14,
  },
  wheelWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  wheelCenterContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  centerIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  centerTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  centerStat: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  centerActionHint: {
    color: theme.textDim,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  quadrantCard: {
    width: '48%',
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardIcon: {
    fontSize: 18,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardLabel: {
    color: theme.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  cardMarathiLabel: {
    color: theme.textDim,
    fontSize: 10,
    marginTop: 1,
  },
  cardSublabel: {
    color: theme.textDim,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  summaryBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  summaryText: {
    color: theme.textDim,
    fontSize: 12,
    flex: 1,
  },
});
