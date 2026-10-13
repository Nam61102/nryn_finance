/**
 * Indian Rupee & IST Date Formatting Utilities
 * Money is stored in integer PAISE everywhere. The UI divides by 100.
 */

export const paiseToRupees = (paise: number): number => {
  return Math.round(paise || 0) / 100;
};

export const formatINR = (
  paise: number,
  opts: { decimals?: boolean; sign?: boolean; absolute?: boolean } = {}
): string => {
  const rawRupees = paiseToRupees(paise);
  const rupees = opts.absolute ? Math.abs(rawRupees) : rawRupees;

  const formatted = Math.abs(rupees).toLocaleString('en-IN', {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  });

  const prefix = opts.sign && rawRupees > 0 ? '+' : opts.sign && rawRupees < 0 ? '-' : '';
  const sign = rawRupees < 0 && !opts.sign && !opts.absolute ? '-' : '';

  return `${sign}${prefix}₹${formatted}`;
};

export const formatCompactINR = (paise: number): string => {
  const rupees = Math.abs(paiseToRupees(paise));
  const sign = paise < 0 ? '-' : '';

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

/**
 * Returns formatted relative time string in IST
 */
export const formatRelativeIST = (input: string | Date | number): string => {
  if (!input) return '';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24 && now.getDate() === d.getDate()) {
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `Today · ${timeStr}`;
  }
  if (diffDays === 1 || (diffHours < 48 && (now.getDate() - d.getDate() === 1 || now.getDate() - d.getDate() < 0))) {
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `Yesterday · ${timeStr}`;
  }

  const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dateStr} · ${timeStr}`;
};
