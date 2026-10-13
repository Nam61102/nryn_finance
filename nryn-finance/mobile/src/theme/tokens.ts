export const lightColors = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  cardAlt: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textDim: '#64748B',
  accent: '#FF6D00',
  accentDark: '#E65100',
  accentLight: '#FFF7ED',
  accentBorder: '#FED7AA',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  dangerBorder: '#FECACA',
  warn: '#F59E0B',
  warnLight: '#FFFBEB',
  warnBorder: '#FDE68A',
  success: '#10B981',
  successLight: '#ECFDF5',
  successBorder: '#A7F3D0',
  chartHighest: '#FF4757',
  chartNewest: '#38BDF8',
  chartLowest: '#10B981',
  chartOldest: '#6366F1',
};

export const darkColors = {
  bg: '#0B1220',
  card: '#121A2B',
  cardAlt: '#1A2438',
  border: '#23304A',
  text: '#F1F5F9',
  textDim: '#94A3B8',
  accent: '#FF6D00',
  accentDark: '#FF8533',
  accentLight: 'rgba(255, 109, 0, 0.15)',
  accentBorder: 'rgba(255, 109, 0, 0.35)',
  danger: '#F87171',
  dangerLight: 'rgba(239, 68, 68, 0.16)',
  dangerBorder: 'rgba(239, 68, 68, 0.35)',
  warn: '#FBBF24',
  warnLight: 'rgba(245, 158, 11, 0.16)',
  warnBorder: 'rgba(245, 158, 11, 0.35)',
  success: '#34D399',
  successLight: 'rgba(16, 185, 129, 0.16)',
  successBorder: 'rgba(16, 185, 129, 0.35)',
  chartHighest: '#FF5A69',
  chartNewest: '#38BDF8',
  chartLowest: '#34D399',
  chartOldest: '#818CF8',
};

export type ThemeColors = typeof lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '800' as const, lineHeight: 38 },
  h1: { fontSize: 24, fontWeight: '800' as const, lineHeight: 30 },
  h2: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  title: { fontSize: 16, fontWeight: '700' as const, lineHeight: 22 },
  body: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  small: { fontSize: 10, fontWeight: '600' as const, lineHeight: 14 },
} as const;

export const getShadows = (isDark: boolean) => ({
  sm: {
    shadowColor: isDark ? '#000000' : '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.3 : 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: isDark ? '#000000' : '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.4 : 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: isDark ? '#000000' : '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.5 : 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  glow: {
    shadowColor: '#FF6D00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.35 : 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
});
