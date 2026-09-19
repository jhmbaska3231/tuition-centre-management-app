// backend/src/lib/time.ts
//
// all calendar math goes through luxon with an explicit zone. calendar dates are
// 'yyyy-mm-dd' strings, instants are js dates (utc). never mix the two without a zone

import { DateTime } from 'luxon';

export const todayIn = (zone: string): string => DateTime.now().setZone(zone).toISODate()!;

export const addDays = (date: string, n: number): string => DateTime.fromISO(date).plus({ days: n }).toISODate()!;

// 0 = sunday to 6 = saturday, matching course_slots.weekday
export const weekdayOf = (date: string): number => DateTime.fromISO(date).weekday % 7;

// local wall clock date and time in a zone > utc instant
export const toInstant = (date: string, time: string, zone: string): Date =>
  DateTime.fromISO(`${date}T${time}`, { zone }).toJSDate();

// utc instant > local calendar date in a zone
export const dateInZone = (instant: Date, zone: string): string =>
  DateTime.fromJSDate(instant).setZone(zone).toISODate()!;

export const addMinutes = (instant: Date, minutes: number): Date => new Date(instant.getTime() + minutes * 60_000);

export const minutesBetween = (a: Date, b: Date): number => Math.abs(b.getTime() - a.getTime()) / 60_000;