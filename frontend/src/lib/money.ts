// frontend/src/lib/money.ts
//
// money crosses the api as integer cents and is typed by people as dollars. conversion is
// string parsing, never float arithmetic: 0.1 + 0.2 is 0.30000000000000004, and
// math.round(1.005 * 100) is 100, not 101

import { z } from 'zod';

// optional thousands separators, at most two decimal places. no sign: amounts entered
// through forms are never negative. at most nine whole digits keeps cents a safe integer
const DOLLARS = /^(\d{1,9})(?:\.(\d{1,2}))?$/;

export const parseCents = (text: string): number | null => {
  const match = DOLLARS.exec(text.trim().replace(/,/g, ''));
  if (!match) return null;
  const [, whole, fraction = ''] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};

// a stored amount as the form's starting text: 18050 becomes "180.50". no symbol and no
// grouping, so the text parses straight back
export const centsToInput = (cents: number | null | undefined): string =>
  cents === null || cents === undefined
    ? ''
    : `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

const INVALID = 'Enter an amount like 180 or 180.50';

// a required amount: the form holds the typed text, the schema outputs cents
export const moneyInput = z.string().transform((text, ctx) => {
  const cents = parseCents(text);
  if (cents === null) {
    ctx.addIssue({ code: 'custom', message: text.trim() === '' ? 'Enter an amount' : INVALID });
    return z.NEVER;
  }
  return cents;
});

// an optional amount: empty means none, and becomes null
export const optionalMoneyInput = z.string().transform((text, ctx) => {
  if (text.trim() === '') return null;
  const cents = parseCents(text);
  if (cents === null) {
    ctx.addIssue({ code: 'custom', message: INVALID });
    return z.NEVER;
  }
  return cents;
});