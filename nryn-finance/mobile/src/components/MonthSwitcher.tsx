import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { useTheme, makeStyles, Theme } from '../theme';
import { haptic } from '../utils/haptics';

type M = { month: string; shortLabel: string; isCurrent: boolean; isFuture: boolean };

export default function MonthSwitcher({
  months,
  value,
  onChange,
}: {
  months: M[];
  value: string;
  onChange: (m: string) => void;
}) {
  const theme = useTheme();
  const styles = useStyles();

  const ordered = [...months].sort((a, b) => a.month.localeCompare(b.month));

  const handlePress = (mStr: string) => {
    haptic.light();
    onChange(mStr);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.wrap}
    >
      {ordered.map((m) => {
        const active = m.month === value;
        return (
          <TouchableOpacity
            key={m.month}
            disabled={m.isFuture}
            onPress={() => handlePress(m.month)}
            activeOpacity={0.8}
            style={[
              styles.pill,
              active && styles.pillActive,
              m.isFuture && styles.pillDisabled,
            ]}
          >
            <Text
              style={[
                styles.text,
                active && styles.textActive,
                m.isFuture && styles.textDisabled,
              ]}
            >
              {m.shortLabel}
            </Text>
            {m.isCurrent && (
              <View style={[styles.now, active && styles.nowActive]}>
                <Text style={[styles.nowText, active && styles.nowTextActive]}>
                  NOW
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    wrap: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      ...t.shadows.sm,
    },
    pillActive: {
      backgroundColor: t.accent,
      borderColor: t.accent,
      ...t.shadows.glow,
    },
    pillDisabled: {
      opacity: 0.35,
    },
    text: {
      color: t.textDim,
      fontSize: 13,
      fontWeight: '700',
    },
    textActive: {
      color: '#FFFFFF',
      fontWeight: '800',
    },
    textDisabled: {
      color: t.textDim,
    },
    now: {
      backgroundColor: t.cardAlt,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    nowActive: {
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    nowText: {
      color: t.accent,
      fontSize: 9,
      fontWeight: '800',
    },
    nowTextActive: {
      color: '#FFFFFF',
    },
  })
);
