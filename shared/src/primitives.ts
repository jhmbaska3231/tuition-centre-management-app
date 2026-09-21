// shared/src/primitives.ts
//
// field level building blocks used by every schema on both sides of the wire,
// changing a rule here changes client validation and server validation together

import { z } from 'zod';

export const uuid = z.uuid();
export const isoDate = z.iso.date();
export const isoDateTime = z.iso.datetime({ offset: true });
export const timeOfDay = z.iso.time({ precision: -1 });

export const email = z.email().trim().toLowerCase().max(254);

// bcrypt only hashes the first 72 bytes, so refuse longer input rather than truncate it silently
export const password = z.string().min(8, 'Password must be at least 8 characters').max(72);

export const personName = z.string().trim().min(1).max(50)
  .regex(/^[A-Za-z][A-Za-z' -]*$/, 'Letters, spaces, hyphens and apostrophes only');

export const sgPhone = z.string().trim().regex(/^\d{8}$/, 'Phone must be exactly 8 digits');

// 0 = sunday, matching course_slots.weekday
export const weekday = z.number().int().min(0).max(6);

// money is integer cents everywhere, never float
export const cents = z.number().int().min(0).max(100_000_000);
export const signedCents = z.number().int().min(-100_000_000).max(100_000_000);

// basis points: 900 = 9%
export const basisPoints = z.number().int().min(0).max(10_000);

export const idParam = z.object({ id: uuid });

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});