export const theme = {
  bg: '#0B0F0D',
  card: '#141A17',
  cardAlt: '#1B2320',
  accent: '#00E676',
  accentDark: '#00B85F',
  text: '#F2F5F3',
  textDim: '#8E9B94',
  border: '#242E29',
  danger: '#FF5252',
  warn: '#FFB300',
  radius: 20,
};

/** Fallback palette — the real one is fetched from GET /api/categories and
 *  cached, so backend and app can never disagree (§6.4). */
export const FALLBACK_CATEGORIES = [
  { key: 'food', label: 'Food & Dining', icon: '🍔', color: '#FF7043' },
  { key: 'groceries', label: 'Groceries', icon: '🛒', color: '#66BB6A' },
  { key: 'transport', label: 'Transport', icon: '🚕', color: '#FFA726' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️', color: '#AB47BC' },
  { key: 'bills_utilities', label: 'Bills', icon: '💡', color: '#29B6F6' },
  { key: 'entertainment', label: 'Entertainment', icon: '🎬', color: '#EC407A' },
  { key: 'health', label: 'Health', icon: '💊', color: '#26A69A' },
  { key: 'education', label: 'Education', icon: '📚', color: '#5C6BC0' },
  { key: 'travel', label: 'Travel', icon: '✈️', color: '#42A5F5' },
  { key: 'rent', label: 'Rent', icon: '🏠', color: '#8D6E63' },
  { key: 'investment', label: 'Investment', icon: '📈', color: '#7E57C2' },
  { key: 'transfer', label: 'Transfer', icon: '🔁', color: '#78909C' },
  { key: 'income', label: 'Income', icon: '💰', color: '#9CCC65' },
  { key: 'other', label: 'Other', icon: '📦', color: '#90A4AE' },
];
