import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { theme } from '../theme';

const TONE: Record<string, { bg: string; icon: string }> = {
  good: { bg: 'rgba(0,230,118,0.14)', icon: '🟢' },
  on_track: { bg: 'rgba(255,179,0,0.14)', icon: '🟡' },
  ahead: { bg: 'rgba(255,179,0,0.18)', icon: '🟠' },
  over: { bg: 'rgba(255,82,82,0.16)', icon: '🔴' },
  no_budget: { bg: 'rgba(255,255,255,0.06)', icon: '⚪️' },
};

/** The copy comes from the SERVER, not the client — one definition of pace. */
export default function PaceBanner({ pace }: { pace: { state: string; copy: string } }) {
  const tone = TONE[pace.state] || TONE.no_budget;
  return (
    <View style={[styles.wrap, { backgroundColor: tone.bg }]}>
      <Text style={{ fontSize: 16 }}>{tone.icon}</Text>
      <Text style={styles.text}>{pace.copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 14 },
  text: { color: theme.text, fontSize: 13, flex: 1, lineHeight: 18 },
});
