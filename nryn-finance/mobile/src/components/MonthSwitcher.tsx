import React, { useEffect, useRef } from 'react';
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
  const scrollRef = useRef<ScrollView>(null);

  const ordered = (Array.isArray(months) ? [...months] : []).sort((a, b) =>
    String(a?.month || '').localeCompare(String(b?.month || ''))
  );

  // Auto-scroll to selected month on mount or change
  useEffect(() => {
    if (!value || ordered.length === 0) return;
    const activeIdx = ordered.findIndex((m) => m.month === value);
    if (activeIdx >= 0 && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          x: Math.max(0, activeIdx * 90 - 40),
          animated: true,
        });
      }, 100);
    }
  }, [value, ordered.length]);

  const handlePress = (mStr: string) => {
    haptic.light();
    onChange(mStr);
  };

  return (
    <ScrollView
      ref={scrollRef}
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
            activeOpacity={0.75}
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
              <View style={[styles.nowDot, active && styles.nowDotActive]} />
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    wrap: {
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      alignItems: 'center',
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
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
      ...t.shadows.sm,
    },
    pillDisabled: {
      opacity: 0.35,
    },
    text: {
      color: t.textDim,
      fontSize: 12,
      fontWeight: '700',
    },
    textActive: {
      color: '#FFFFFF',
      fontWeight: '800',
    },
    textDisabled: {
      color: t.textDim,
    },
    nowDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: t.accent,
    },
    nowDotActive: {
      backgroundColor: '#FFFFFF',
    },
  })
);
