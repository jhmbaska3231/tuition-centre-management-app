// shared/src/schemas/users.ts

import { z } from 'zod';
import { email, password, personName, sgPhone, uuid } from '../primitives';

export const updateProfileSchema = z.object({
  firstName: personName,
  lastName: personName,
  phone: sgPhone.nullable(),
}).partial().refine(o => Object.keys(o).length > 0, 'No fields to update');
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: password,
}).refine(p => p.currentPassword !== p.newPassword, {
  path: ['newPassword'], message: 'New password must be different',
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(72),
  confirm: z.literal('DELETE'),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export const listParentsQuery = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  includeArchived: z.stringbool().default(false),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// no password field: the parent sets their own via the emailed reset link
export const createParentSchema = z.object({
  email,
  firstName: personName,
  lastName: personName,
  phone: sgPhone.optional(),
});
export type CreateParentInput = z.infer<typeof createParentSchema>;

export const updateParentSchema = updateProfileSchema;
export const parentIdParam = z.object({ id: uuid });