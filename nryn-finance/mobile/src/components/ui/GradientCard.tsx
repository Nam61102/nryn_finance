import React from 'react';
import { StyleSheet, StyleProp, ViewStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';

interface GradientCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

export default function GradientCard({
  children,
  style,
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
}: GradientCardProps) {
  const theme = useTheme();

  // Default fintech orange gradient in light mode; in dark mode, deep navy-to-orange glow
  const defaultColors = theme.isDark
    ? ['#1E293B', '#0F172A']
    : ['#FF6D00', '#E65100'];

  const finalColors = ((colors && colors.length >= 2 ? colors : defaultColors) as unknown) as readonly [string, string, ...string[]];

  return (
    <View style={[styles.shadowWrap, theme.shadows.glow, style]}>
      <LinearGradient
        colors={finalColors}
        start={start}
        end={end}
        style={[
          styles.container,
          {
            borderRadius: theme.radius.xl,
            borderColor: theme.isDark ? 'rgba(255, 109, 0, 0.25)' : 'rgba(255, 255, 255, 0.2)',
          },
        ]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: 28,
  },
  container: {
    padding: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
