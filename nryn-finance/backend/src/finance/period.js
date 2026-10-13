'use strict';
const { DateTime } = require('luxon');
const ZONE = process.env.TZ_APP || 'Asia/Kolkata';

/**
 * The month is the app's primary axis (§7.1). Every boundary is computed in
 * Asia/Kolkata — a UTC month boundary moves a 31 March 11pm spend into April
 * and shifts two months' budgets at once.
 */
function resolveMonth(monthStr) {
  const now = DateTime.now().setZone(ZONE);
  let dt = monthStr ? DateTime.fromFormat(String(monthStr), 'yyyy-MM', { zone: ZONE }) : now;
  if (!dt.isValid) dt = now;

  const start = dt.startOf('month');
  const end = start.endOf('month');
  const isCurrent = start.hasSame(now, 'month') && start.hasSame(now, 'year');
  const totalDays = start.daysInMonth;
  const elapsedDays = isCurrent ? now.day : (start < now ? totalDays : 0);

  return {
    month: start.toFormat('yyyy-MM'),
    label: start.toFormat("LLLL ''yy"),
    shortLabel: start.toFormat("LLL ''yy"),
    start: start.toJSDate(),
    end: end.toJSDate(),
    isCurrent,
    isFuture: start > now,
    totalDays,
    elapsedDays,
    prev: start.minus({ months: 1 }).toFormat('yyyy-MM'),
    next: start.plus({ months: 1 }).toFormat('yyyy-MM'),
  };
}

/** Free-form range for the analytics screen (24H / 7D / 30D / 6M / 1Y). */
function resolveRange(range = '30d') {
  const now = DateTime.now().setZone(ZONE);
  const map = {
    today: [now.startOf('day'), now.endOf('day'), 'hour'],
    '24h': [now.minus({ hours: 24 }), now, 'hour'],
    '7d': [now.minus({ days: 6 }).startOf('day'), now.endOf('day'), 'day'],
    '30d': [now.minus({ days: 29 }).startOf('day'), now.endOf('day'), 'day'],
    month: [now.startOf('month'), now.endOf('month'), 'day'],
    '6m': [now.minus({ months: 5 }).startOf('month'), now.endOf('month'), 'month'],
    '1y': [now.minus({ months: 11 }).startOf('month'), now.endOf('month'), 'month'],
  };
  const [start, end, bucket] = map[range] || map['30d'];
  return { range, start: start.toJSDate(), end: end.toJSDate(), bucket };
}

const startOfToday = () => DateTime.now().setZone(ZONE).startOf('day').toJSDate();

function startOfDay(dtOrDate) {
  const dt = dtOrDate
    ? (dtOrDate instanceof DateTime ? dtOrDate.setZone(ZONE) : DateTime.fromJSDate(new Date(dtOrDate), { zone: ZONE }))
    : DateTime.now().setZone(ZONE);
  return dt.startOf('day').toJSDate();
}

function endOfDay(dtOrDate) {
  const dt = dtOrDate
    ? (dtOrDate instanceof DateTime ? dtOrDate.setZone(ZONE) : DateTime.fromJSDate(new Date(dtOrDate), { zone: ZONE }))
    : DateTime.now().setZone(ZONE);
  return dt.endOf('day').toJSDate();
}

/**
 * Indian Financial Year runs 1 April → 31 March (§11.1).
 * If month is Jan-Mar (1..3), FY started 1 April of previous year.
 * If month is Apr-Dec (4..12), FY started 1 April of current year.
 */
function resolveFinancialYear(dtOrDate) {
  const now = dtOrDate
    ? (dtOrDate instanceof DateTime ? dtOrDate.setZone(ZONE) : DateTime.fromJSDate(new Date(dtOrDate), { zone: ZONE }))
    : DateTime.now().setZone(ZONE);

  const startYear = now.month >= 4 ? now.year : now.year - 1;
  const start = DateTime.fromObject({ year: startYear, month: 4, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }, { zone: ZONE });
  const end = DateTime.fromObject({ year: startYear + 1, month: 3, day: 31, hour: 23, minute: 59, second: 59, millisecond: 999 }, { zone: ZONE });
  const label = `FY ${startYear}-${String(startYear + 1).slice(-2)}`;
  const financialYear = `${startYear}-${String(startYear + 1).slice(-2)}`;

  return {
    startYear,
    endYear: startYear + 1,
    start: start.toJSDate(),
    end: end.toJSDate(),
    label,
    financialYear,
  };
}

module.exports = { ZONE, resolveMonth, resolveRange, startOfToday, startOfDay, endOfDay, resolveFinancialYear };
