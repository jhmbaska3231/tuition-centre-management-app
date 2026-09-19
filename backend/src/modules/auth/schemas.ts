// backend/src/modules/auth/schemas.ts

import { z } from 'zod';

const email = z.email().trim().toLowerCase().max(254);

// bcrypt only uses the first 72 bytes, refuse longer input rather than silently truncate
const password = z.string().min(8, 'Password must be at least 8 characters').max(72);

const personName = z.string().trim().min(1).max(50).regex(/^[A-Za-z][A-Za-z' -]*$/, 'Letters, spaces, hyphens and apostrophes only');

const sgPhone = z.string().trim().regex(/^\d{8}$/, 'Phone must be exactly 8 digits');

export const registerSchema = z.object({
  firstName: personName,
  lastName: personName,
  email,
  password,
  phone: sgPhone.optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});

export const passwordResetRequestSchema = z.object({ email });

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20).max(128),
  password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;