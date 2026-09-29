import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { theme } from '../theme';

export type SortKey = 'amount_desc' | 'amount_asc' | 'date_desc' | 'date_asc';

export interface SortOption {
  key: SortKey;
  label: string;
  icon: string;
  color: string;
  sublabel: string;
  startAngle: number;
  endAngle: number;
}

// 4 Donut wedges matching the user's reference donut chart palette:
// Red (Highest), Sky Blue (Newest), Emerald (Lowest), Slate Indigo (Oldest)
export const SORT_OPTIONS: SortOption[] = [
  {
    key: 'amount_desc',
    label: 'Highest',
    icon: '💎',
    color: '#FF4757', // Ruby / Crimson Red (like reference image)
    sublabel: 'Highest first',
    startAngle: 0,
    endAngle: 90,
  },
  {
    key: 'date_desc',
    label: 'Newest',
    icon: '⚡',
    color: '#38BDF8', // Sky Blue (like reference image)
    sublabel: 'Latest first',
    startAngle: 90,
    endAngle: 180,
  },
  {
    key: 'amount_asc',
    label: 'Lowest',
    icon: '🪙',
    color: '#10B981', // Mint / Emerald Green (like reference image)
    sublabel: 'Lowest first',
    startAngle: 180,
    endAngle: 270,
  },
  {
    key: 'date_asc',
    label: 'Oldest',
    icon: '⏳',
    color: '#6366F1', // Slate Navy / Indigo (like reference image)
    sublabel: 'Earliest first',
    startAngle: 270,
    endAngle: 360,
  },
];

interface Props {
  currentSort: string;
  onSelectSort: (key: string) => void;
  txns: any[];
  totalCount?: number;
}

/**
 * Calculates an SVG path for an annular donut slice
 */
function describeDonutSlice(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const rad = Math.PI / 180;
  // Rotate so 0 deg starts at top (12 o'clock)
  const a1 = (startAngleDeg - 90) * rad;
  const a2 = (endAngleDeg - 90) * rad;

  const x1Outer = cx + rOuter * Math.cos(a1);
  const y1Outer = cy + rOuter * Math.sin(a1);

  const x2Outer = cx + rOuter * Math.cos(a2);
  const y2Outer = cy + rOuter * Math.sin(a2);

  const x2Inner = cx + rInner * Math.cos(a2);
  const y2Inner = cy + rInner * Math.sin(a2);

  const x1Inner = cx + rInner * Math.cos(a1);
  const y1Inner = cy + rInner * Math.sin(a1);

  const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0;

  return [
    `M ${x1Outer.toFixed(2)} ${y1Outer.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${x2Outer.toFixed(2)} ${y2Outer.toFixed(2)}`,
    `L ${x2Inner.toFixed(2)} ${y2Inner.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${x1Inner.toFixed(2)} ${y1Inner.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export default function ExpensesCircularGraph({ currentSort, onSelectSort, txns }: Props) {
  const size = 196;
  const cx = size / 2;
  const cy = size / 2;
  const defaultRInner = 48;
  const defaultROuter = 82;

  const activeOption = SORT_OPTIONS.find((s) => s.key === currentSort) || SORT_OPTIONS[0];

  const getStatForOption = (key: SortKey) => {
    const opt = SORT_OPTIONS.find((s) => s.key === key);
    return opt?.sublabel ?? '';
  };

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerIcon}>🍩</Text>
          <Text style={styles.headerTitle}>Expense Breakdown Graph</Text>
        </View>
        <View style={[styles.activeBadge, { borderColor: `${activeOption.color}45`, backgroundColor: `${activeOption.color}15` }]}>
          <Text style={[styles.activeBadgeText, { color: activeOption.color }]}>
            {activeOption.icon} {activeOption.label}
          </Text>
        </View>
      </View>

      <Text style={styles.subHint}>
        Touch any slice on the donut graph to filter expenses:
      </Text>

      {/* Solid Donut Chart Graphic */}
      <View style={styles.chartWrapper}>
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size}>
            <G>
              {SORT_OPTIONS.map((opt) => {
                const isActive = opt.key === currentSort;
                const midAngle = (opt.startAngle + opt.endAngle) / 2;
                const rad = (midAngle - 90) * (Math.PI / 180);

                // If active, slice pops out by 5px and expands outer radius by 3px
                const popDist = isActive ? 5 : 0;
                const sliceCx = cx + popDist * Math.cos(rad);
                const sliceCy = cy + popDist * Math.sin(rad);
                const rOut = isActive ? defaultROuter + 3 : defaultROuter;
                const rIn = defaultRInner;

                const pathData = describeDonutSlice(sliceCx, sliceCy, rIn, rOut, opt.startAngle, opt.endAngle);

                return (
                  <Path
                    key={opt.key}
                    d={pathData}
                    fill={opt.color}
                    opacity={isActive ? 1 : 0.65}
                    stroke={theme.card}
                    strokeWidth={2.5}
                    onPress={() => onSelectSort(opt.key)}
                  />
                );
              })}
            </G>
          </Svg>

          {/* Donut Hole Center Content */}
          <View style={styles.donutHole} pointerEvents="none">
            <Text style={styles.centerIcon}>{activeOption.icon}</Text>
            <Text style={[styles.centerTitle, { color: activeOption.color }]}>{activeOption.label}</Text>
            <Text style={styles.centerStat}>{getStatForOption(activeOption.key)}</Text>
            <Text style={styles.centerActionHint}>Tap slice</Text>
          </View>
        </View>
      </View>

      {/* 4 Quadrants Interactive Touch Grid */}
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
                  backgroundColor: `${opt.color}16`,
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
                <View style={[styles.colorChip, { backgroundColor: opt.color }]} />
                <Text style={styles.cardIcon}>{opt.icon}</Text>
              </View>

              <Text style={[styles.cardLabel, isActive && { color: theme.text, fontWeight: '800' }]}>
                {opt.label}
              </Text>
              <Text style={[styles.cardSublabel, isActive && { color: opt.color, fontWeight: '800' }]}>
                {getStatForOption(opt.key)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Active Filter Summary Bar */}
      <View style={[styles.summaryBar, { borderColor: `${activeOption.color}35`, backgroundColor: `${activeOption.color}10` }]}>
        <View style={[styles.summaryBullet, { backgroundColor: activeOption.color }]} />
        <Text style={styles.summaryText}>
          Showing <Text style={{ color: activeOption.color, fontWeight: '700' }}>{activeOption.label}</Text> expenses below:
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
    padding: 18,
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
    fontSize: 16,
    fontWeight: '800',
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
    marginBottom: 10,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  donutHole: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  centerIcon: {
    fontSize: 22,
    marginBottom: 1,
  },
  centerTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  centerStat: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  centerActionHint: {
    color: theme.textDim,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  quadrantCard: {
    width: '48%',
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  colorChip: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  cardIcon: {
    fontSize: 16,
  },
  cardLabel: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '700',
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
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
