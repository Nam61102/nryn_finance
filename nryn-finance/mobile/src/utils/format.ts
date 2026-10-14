/**
 * Indian Rupee & IST Date Formatting Utilities
 * Money is stored in integer PAISE everywhere. The UI divides by 100.
 */

export const paiseToRupees = (paise: number | null | undefined): number => {
  const val = Number(paise);
  if (!Number.isFinite(val)) return 0;
  return Math.round(val) / 100;
};

export const formatNumberINR = (num: number | null | undefined): string => {
  const val = Number(num);
  if (!Number.isFinite(val)) return '0';
  try {
    return Math.round(val).toLocaleString('en-IN');
  } catch {
    return String(Math.round(val));
  }
};

export const formatINR = (
  paise: number | null | undefined,
  opts: { decimals?: boolean; sign?: boolean; absolute?: boolean } = {}
): string => {
  const rawRupees = paiseToRupees(paise);
  if (!Number.isFinite(rawRupees)) return '₹0';
  const rupees = opts.absolute ? Math.abs(rawRupees) : rawRupees;

  let formatted = '0';
  try {
    formatted = Math.abs(rupees).toLocaleString('en-IN', {
      minimumFractionDigits: opts.decimals ? 2 : 0,
      maximumFractionDigits: opts.decimals ? 2 : 0,
    });
  } catch {
    formatted = String(Math.abs(rupees));
  }

  const prefix = opts.sign && rawRupees > 0 ? '+' : opts.sign && rawRupees < 0 ? '-' : '';
  const sign = rawRupees < 0 && !opts.sign && !opts.absolute ? '-' : '';

  return `${sign}${prefix}₹${formatted}`;
};

export const formatCompactINR = (paise: number | null | undefined): string => {
  const rupees = Math.abs(paiseToRupees(paise));
  if (!Number.isFinite(rupees)) return '₹0';
  const sign = (paise || 0) < 0 ? '-' : '';

  if (rupees >= 10000000) {
    const cr = (rupees / 10000000).toFixed(1).replace(/\.0$/, '');
    return `${sign}₹${cr}Cr`;
  }
  if (rupees >= 100000) {
    const lk = (rupees / 100000).toFixed(1).replace(/\.0$/, '');
    return `${sign}₹${lk}L`;
  }
  if (rupees >= 1000) {
    const k = (rupees / 1000).toFixed(1).replace(/\.0$/, '');
    return `${sign}₹${k}k`;
  }
  return `${sign}₹${Math.round(rupees)}`;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Returns formatted relative time string in IST
 * 100% pure JS date formatting — never throws locale or ICU errors on Android Hermes
 */
export const formatRelativeIST = (input: string | Date | number): string => {
  if (!input) return '';
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${mins}`;

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24 && now.getDate() === d.getDate() && now.getMonth() === d.getMonth()) {
      return `Today · ${timeStr}`;
    }
    if (diffDays === 1 || (diffHours < 48 && (now.getDate() - d.getDate() === 1 || now.getDate() - d.getDate() < 0))) {
      return `Yesterday · ${timeStr}`;
    }

    const dateStr = `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()] || ''}`;
    return `${dateStr} · ${timeStr}`;
  } catch {
    return '';
  }
};
