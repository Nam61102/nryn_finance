'use strict';
/**
 * ONE source of truth for categories, icons and colours.
 * The mobile app fetches this via GET /api/categories and caches it, so the
 * budget chip, the analytics legend and the expense row can never disagree.
 * (Plan §6.4 — category owns the colour, merchant owns the icon.)
 */
const CATEGORIES = [
  { key: 'food',           label: 'Food & Dining', icon: '🍔', color: '#FF7043' },
  { key: 'groceries',      label: 'Groceries',     icon: '🛒', color: '#66BB6A' },
  { key: 'transport',      label: 'Transport',     icon: '🚕', color: '#FFA726' },
  { key: 'shopping',       label: 'Shopping',      icon: '🛍️', color: '#AB47BC' },
  { key: 'bills_utilities',label: 'Bills',         icon: '💡', color: '#29B6F6' },
  { key: 'entertainment',  label: 'Entertainment', icon: '🎬', color: '#EC407A' },
  { key: 'health',         label: 'Health',        icon: '💊', color: '#26A69A' },
  { key: 'education',      label: 'Education',     icon: '📚', color: '#5C6BC0' },
  { key: 'travel',         label: 'Travel',        icon: '✈️', color: '#42A5F5' },
  { key: 'rent',           label: 'Rent',          icon: '🏠', color: '#8D6E63' },
  { key: 'investment',     label: 'Investment',    icon: '📈', color: '#7E57C2' },
  { key: 'transfer',       label: 'Transfer',      icon: '🔁', color: '#78909C' },
  { key: 'income',         label: 'Income',        icon: '💰', color: '#9CCC65' },
  { key: 'other',          label: 'Other',         icon: '📦', color: '#90A4AE' },
];

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
const BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

/** Categories that never count toward the spend total (plan §6.2). */
const NON_EXPENSE_CATEGORIES = ['investment', 'transfer', 'income'];

const iconFor = (key) => (BY_KEY[key] || BY_KEY.other).icon;
const colorFor = (key) => (BY_KEY[key] || BY_KEY.other).color;

function inferCategory(merchantName, body = '') {
  const text = (String(merchantName || '') + ' ' + String(body || '')).toLowerCase();
  if (/(?:pmpml|pune mahanagar|msrtc|maharashtra stat|state transport|st bus|metro|uber|ola|rapido|irctc|railway|auto|rickshaw|petrol|fuel|hpcl|bpcl|iocl|indian oil|transport|bus|toll|fastag|parking)/i.test(text)) {
    return 'transport';
  }
  if (/(?:super market|super ma|dmart|avenue sup|grocery|groceries|kirana|vegetable|fruit|zepto|blinkit|instamart|bigbasket|bbdaily|fresh|dairy|milk|spencer|provision|general store|bazaar)/i.test(text)) {
    return 'groceries';
  }
  if (/(?:cafe|coffee|tea|chai|snack|snac|kachori|vadewale|wada|hotel|restaurant|restro|bistro|kitchen|dhaba|swiggy|zomato|eats|food|dining|bakery|bake|sweets|mithai|caterers|pizza|burger|canteen|mess|lunch|dinner|breakfast|barbeque|biryani|shawarma|ice cream|juice|beverage)/i.test(text)) {
    return 'food';
  }
  if (/(?:medico|medical|pharma|chemist|hospital|clinic|doctor|diagnostic|lab|pathology|wellness|apollo|1mg|netmeds|dentist|healthcare|ayurveda)/i.test(text)) {
    return 'health';
  }
  if (/(?:jio|airtel|vodafone|vi recharge|bsnl|electricity|msedcl|bescom|tneb|gas|indane|bharat gas|hp gas|broadband|wifi|water|bill|dth|tatasky|dish tv|recharge|cylinder)/i.test(text)) {
    return 'bills_utilities';
  }
  if (/(?:amazon|flipkart|myntra|meesho|nykaa|zudio|trends|pantaloons|max fashion|cloth|textile|garment|jewel|footwear|bata|mall|shopee|lifestyle|boutique|tailor)/i.test(text)) {
    return 'shopping';
  }
  if (/(?:netflix|spotify|prime video|hotstar|cinema|pvr|inox|theatre|movie|game|gaming|youtube|playstation|amusement)/i.test(text)) {
    return 'entertainment';
  }
  if (/(?:school|college|class|coaching|tuition|university|academy|course|books|stationery|exam|fee)/i.test(text)) {
    return 'education';
  }
  if (/(?:groww|zerodha|upstox|angel|mutual fund|sip|nse|bse|coin|ppf|nps|sebi)/i.test(text)) {
    return 'investment';
  }
  return 'other';
}

module.exports = { CATEGORIES, CATEGORY_KEYS, BY_KEY, NON_EXPENSE_CATEGORIES, iconFor, colorFor, inferCategory };
