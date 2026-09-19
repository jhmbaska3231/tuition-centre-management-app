// backend/src/modules/users/schemas.ts

import { z } from 'zod';
import { uuid } from '../../http/middleware/validate';

const personName = z.string().trim().min(1).max(50).regex(/^[A-Za-z][A-Za-z' -]*$/, 'Letters, spaces, hyphens and apostrophes only');
const sgPhone = z.string().trim().regex(/^\d{8}$/, 'Phone must be exactly 8 digits');

export const updateProfileSchema = z.object({ firstName: personName, lastName: personName, phone: sgPhone.nullable() })
  .partial().refine(o => Object.keys(o).length > 0, 'No fields to update');

export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(72), newPassword: z.string().min(8).max(72) })
  .refine(p => p.currentPassword !== p.newPassword, { path: ['newPassword'], message: 'New password must be different' });

export const deleteAccountSchema = z.object({ password: z.string().min(1).max(72), confirm: z.literal('DELETE') });

export const listParentsQuery = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  includeArchived: z.stringbool().default(false),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// staff onboarding a parent. no password: an invite email with a reset link is sent
export const createParentSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  firstName: personName, lastName: personName, phone: sgPhone.optional(),
});
export const updateParentSchema = updateProfileSchema;
export const parentIdParam = z.object({ id: uuid });