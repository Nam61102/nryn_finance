import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { theme } from '../theme';

type M = { month: string; shortLabel: string; isCurrent: boolean; isFuture: boolean };

/**
 * Only renders months that actually have data (plus the current one), so the
 * switcher can never page into an empty 2019. A future month is DISABLED,
 * not hidden — hiding it makes the control look broken on the 1st.
 */
export default function MonthSwitcher({ months, value, onChange }: { months: M[]; value: string; onChange: (m: string) => void }) {
  const ordered = [...months].sort((a, b) => a.month.localeCompare(b.month));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wrap}>
      {ordered.map((m) => {
        const active = m.month === value;
        return (
          <TouchableOpacity
            key={m.month}
            disabled={m.isFuture}
            onPress={() => onChange(m.month)}
            style={[styles.pill, active && styles.pillActive, m.isFuture && styles.pillDisabled]}
          >
            <Text style={[styles.text, active && styles.textActive, m.isFuture && styles.textDisabled]}>{m.shortLabel}</Text>
            {m.isCurrent && (
              <View style={[styles.now, active && { backgroundColor: '#0B0F0D' }]}>
                <Text style={[styles.nowText, active && { color: theme.accent }]}>NOW</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  pillActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
    shadowColor: theme.accent,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  pillDisabled: { opacity: 0.35 },
  text: { color: theme.textDim, fontWeight: '600', fontSize: 13 },
  textActive: { color: '#FFFFFF', fontWeight: '800' },
  textDisabled: { color: theme.textDim },
  now: { backgroundColor: 'rgba(255, 109, 0, 0.15)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  nowText: { fontSize: 9, fontWeight: '800', color: theme.accent },
});
