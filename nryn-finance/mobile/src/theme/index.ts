import { lightColors } from './tokens';

export * from './tokens';
export * from './ThemeContext';

/**
 * Backwards compatibility theme object
 */
export const theme = {
  ...lightColors,
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
