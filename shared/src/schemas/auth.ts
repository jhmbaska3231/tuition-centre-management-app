// shared/src/schemas/auth.ts

import { z } from 'zod';
import { email, password, personName, sgPhone } from '../primitives';

export const registerSchema = z.object({
  firstName: personName,
  lastName: personName,
  email,
  password,
  phone: sgPhone.optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordResetRequestSchema = z.object({ email });
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20).max(128),
  password,
});
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;