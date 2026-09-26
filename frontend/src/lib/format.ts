// frontend/src/lib/format.ts
//
// all display formatting goes through here, configured once from /api/org
//
// timezone is the centre's, not the browser's. a tutor checking tomorrow's schedule from
// overseas must see the times their students will see

import type { BillingCycle } from '@tuition/shared';

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

// the symbol money() prints, for input prefixes. read from the same formatter so the two
// always agree
export const currencySymbol = (): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency })
    .formatToParts(0)
    .find(part => part.type === 'currency')?.value ?? currency;

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

// a weekly slot as a parent reads it: "saturdays, 10:00 am, 1h 30m"
export const formatSlot = (slot: { weekday: number; start_time: string; duration_minutes: number }): string =>
  `${formatWeekday(slot.weekday)}s, ${formatClockTime(slot.start_time)}, ${formatDuration(slot.duration_minutes)}`;

const CYCLE_SUFFIX: Record<BillingCycle, string> = {
  monthly: 'per month',
  per_term: 'per term',
  per_session: 'per session',
};

// "$180.00 per month". a course without a fee plan has no price to show yet
export const formatFee = (cents: number | null, cycle: BillingCycle | null): string =>
  cents === null || cycle === null ? 'Fee to be confirmed' : `${money(cents)} ${CYCLE_SUFFIX[cycle]}`;

// today's date in the centre's timezone, as a dateonly string. used for query defaults
// so 'this week' means the centre's week
export const todayInCentre = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

export const addDays = (d: string, n: number): string =>
  new Date(dateOnlyToDate(d).getTime() + n * 86_400_000).toISOString().slice(0, 10);

// monday of the week containing d. singapore weeks start on monday
export const startOfWeek = (d: string): string => {
  const weekday = dateOnlyToDate(d).getUTCDay();
  return addDays(d, -((weekday + 6) % 7));
};

export const startOfMonth = (d: string): string => `${d.slice(0, 8)}01`;

// day zero of the next month is the last day of this one
export const endOfMonth = (d: string): string => {
  const date = dateOnlyToDate(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10);
};

// whole days from one dateonly to another, counted the way the api's range limit counts them
export const daysBetween = (from: string, to: string): number =>
  Math.round((dateOnlyToDate(to).getTime() - dateOnlyToDate(from).getTime()) / 86_400_000);

export const fullName = (p: { first_name: string; last_name: string }): string =>
  `${p.first_name} ${p.last_name}`;

// "john", "john and sarah", "john, sarah and mei", joined the way the centre's locale joins lists
export const formatList = (items: string[]): string =>
  new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);

export const initials = (p: { first_name: string; last_name: string }): string =>
  `${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}`.toUpperCase();