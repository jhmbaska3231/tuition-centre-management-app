// frontend/src/lib/format.ts
//
// all display formatting goes through here, configured once from /api/org
//
// timezone is the centre's, not the browser's. a tutor checking tomorrow's schedule from
// overseas must see the times their students will see

let timezone = 'Asia/Singapore';
let currency = 'SGD';
let locale = 'en-SG';

export const configureFormatting = (opts: { timezone: string; currency: string; locale?: string }): void => {
  timezone = opts.timezone;
  currency = opts.currency;
  if (opts.locale) locale = opts.locale;
};

export const getTimezone = (): string => timezone;

// money is always integer cents
export const money = (cents: number): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);

// plain number without the symbol, for table columns with a currency header
export const amount = (cents: number): string =>
  new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);

// a dateonly string ('2026-09-21') has no timezone. parsing it as utc noon prevents it
// from accidentally showing as the previous day in time zones behind utc (west of greenwich)
const dateOnlyToDate = (d: string): Date => new Date(`${d}T12:00:00Z`);

export const formatDate = (d: string): string =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(dateOnlyToDate(d));

export const formatDateLong = (d: string): string =>
  new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(dateOnlyToDate(d));

// timestamps are instants and convert into the centre's timezone
export const formatTime = (ts: string): string =>
  new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(ts));

export const formatDateTime = (ts: string): string =>
  new Intl.DateTimeFormat(locale, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: timezone,
  }).format(new Date(ts));

export const formatTimeRange = (start: string, end: string): string =>
  `${formatTime(start)} to ${formatTime(end)}`;

// 'hh:mm:ss' from a course slot, with no date attached
export const formatClockTime = (t: string): string => {
  const [h, m] = t.split(':').map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(d);
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const formatWeekday = (weekday: number): string => WEEKDAYS[weekday] ?? '';
export const formatWeekdayShort = (weekday: number): string => WEEKDAYS[weekday]?.slice(0, 3) ?? '';

export const formatDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? '1 hour' : `${h} hours`;
  return `${h}h ${m}m`;
};

// today's date in the centre's timezone, as a dateonly string. used for query defaults
// so 'this week' means the centre's week
export const todayInCentre = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

export const addDays = (d: string, n: number): string =>
  new Date(dateOnlyToDate(d).getTime() + n * 86_400_000).toISOString().slice(0, 10);

export const fullName = (p: { first_name: string; last_name: string }): string =>
  `${p.first_name} ${p.last_name}`;

export const initials = (p: { first_name: string; last_name: string }): string =>
  `${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}`.toUpperCase();