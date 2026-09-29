export const theme = {
  bg: '#F8FAFC',          // Clean, crisp, high-end off-white background
  card: '#FFFFFF',        // Pure white card surfaces
  cardAlt: '#F1F5F9',     // Subtle light slate for chips, tags, and secondary containers
  accent: '#FF6D00',      // Vibrant, high-end professional fintech orange
  accentDark: '#E65100',  // Deep warm orange for active/hover states
  accentLight: '#FFF7ED', // Soft warm orange wash for icon & badge backgrounds
  accentBorder: '#FED7AA',// Soft warm orange border
  text: '#0F172A',        // Deep rich slate-black for maximum contrast & crisp readability
  textDim: '#64748B',     // Balanced slate gray for sublabels & metadata
  border: '#E2E8F0',      // Crisp, subtle modern light border
  danger: '#EF4444',      // Modern clean red
  warn: '#F59E0B',        // Warm amber
  success: '#10B981',     // Fresh emerald green
  radius: 20,
};

/** Fallback palette — the real one is fetched from GET /api/categories and
 *  cached, so backend and app can never disagree (§6.4). */
export const FALLBACK_CATEGORIES = [
  { key: 'food', label: 'Food & Dining', icon: '🍔', color: '#FF7043' },
  { key: 'groceries', label: 'Groceries', icon: '🛒', color: '#10B981' },
  { key: 'transport', label: 'Transport', icon: '🚕', color: '#FFA726' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️', color: '#AB47BC' },
  { key: 'bills_utilities', label: 'Bills', icon: '💡', color: '#0EA5E9' },
  { key: 'entertainment', label: 'Entertainment', icon: '🎬', color: '#EC407A' },
  { key: 'health', label: 'Health', icon: '💊', color: '#14B8A6' },
  { key: 'education', label: 'Education', icon: '📚', color: '#6366F1' },
  { key: 'travel', label: 'Travel', icon: '✈️', color: '#38BDF8' },
  { key: 'rent', label: 'Rent', icon: '🏠', color: '#8D6E63' },
  { key: 'investment', label: 'Investment', icon: '📈', color: '#8B5CF6' },
  { key: 'transfer', label: 'Transfer', icon: '🔁', color: '#64748B' },
  { key: 'income', label: 'Income', icon: '💰', color: '#22C55E' },
  { key: 'other', label: 'Other', icon: '📦', color: '#94A3B8' },
];
