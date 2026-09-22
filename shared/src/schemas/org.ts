// shared/src/schemas/org.ts

import { z } from 'zod';
import { ATTENDANCE_STATUSES, INTEGRATION_KINDS, NOTIFICATION_EVENTS } from '../enums';
import { basisPoints, isoDate, personName, sgPhone, uuid } from '../primitives';

export const updateSettingsSchema = z.object({
  session_horizon_weeks: z.number().int().min(1).max(52),
  adhoc_min_lead_minutes: z.number().int().min(0),
  adhoc_max_lead_days: z.number().int().min(1),
  travel_buffer_minutes: z.number().int().min(0),
  attendance_edit_window_days: z.number().int().min(0),
  waitlist_offer_hours: z.number().int().min(1),
  makeup_eligible_statuses: z.array(z.enum(ATTENDANCE_STATUSES)).min(1),
  makeup_expiry_policy: z.enum(['end_of_term', 'fixed_days']),
  makeup_expiry_days: z.number().int().min(1),
  makeup_min_lead_minutes: z.number().int().min(0),
  makeup_cap_per_term: z.number().int().min(1).nullable(),
  billing_generation_day: z.number().int().min(1).max(28),
  billing_due_day: z.number().int().min(1).max(28),
  tax_rate_bp: basisPoints,
  sibling_discount_bp: basisPoints,
  invoice_prefix: z.string().trim().min(1).max(10).regex(/^[A-Z0-9-]+$/, 'Uppercase letters, digits and hyphens only'),
  payment_instructions: z.string().trim().max(2000).nullable().optional(),
}).partial().refine(o => Object.keys(o).length > 0, 'No fields to update');
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const eventKeyParam = z.object({ eventKey: z.enum(NOTIFICATION_EVENTS) });
export const toggleEventSchema = z.object({ enabled: z.boolean() });

export const integrationKindParam = z.object({ kind: z.enum(INTEGRATION_KINDS) });
export const upsertIntegrationSchema = z.object({
  provider: z.string().trim().min(1).max(50),
  // provider specific keys (host, port, apiKey, from etc). validated per provider by
  // the notifications module when it connects, here only require a flat string map
  config: z.record(z.string(), z.string().min(1).max(2000))
    .refine(c => Object.keys(c).length > 0, 'Config cannot be empty'),
  is_active: z.boolean().default(true),
});
export type UpsertIntegrationInput = z.infer<typeof upsertIntegrationSchema>;

const name = z.string().trim().min(1).max(100);

const branchFields = z.object({
  name,
  address: z.string().trim().min(5).max(200),
  phone: sgPhone.optional(),
});
export const createBranchSchema = branchFields;
export const updateBranchSchema = branchFields.partial().refine(o => Object.keys(o).length > 0, 'No fields to update');
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

const classroomFields = z.object({ name, capacity: z.number().int().min(1).max(500) });
export const createClassroomSchema = classroomFields;
export const updateClassroomSchema = classroomFields.partial().refine(o => Object.keys(o).length > 0, 'No fields to update');
export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;
export type UpdateClassroomInput = z.infer<typeof updateClassroomSchema>;

export const createClosureSchema = z.object({
  branch_id: uuid.nullable().default(null),
  starts_on: isoDate,
  ends_on: isoDate,
  reason: z.string().trim().min(1).max(200),
}).refine(c => c.ends_on >= c.starts_on, { path: ['ends_on'], message: 'ends_on must not be before starts_on' });
export type CreateClosureInput = z.infer<typeof createClosureSchema>;

export const closureRangeQuery = z.object({ from: isoDate.optional(), to: isoDate.optional() });

const levelFields = z.object({
  code: z.string().trim().min(1).max(10).regex(/^[A-Z0-9]+$/, 'Uppercase letters and digits only'),
  name,
  sort_order: z.number().int().min(0),
});
export const createLevelSchema = levelFields;
export const updateLevelSchema = levelFields.partial().refine(o => Object.keys(o).length > 0, 'No fields to update');
export type CreateLevelInput = z.infer<typeof createLevelSchema>;
export type UpdateLevelInput = z.infer<typeof updateLevelSchema>;

export const createSubjectSchema = z.object({ name });
export const updateSubjectSchema = createSubjectSchema;
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

export const createStaffSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(8).max(72),
  role: z.enum(['tutor', 'branch_manager', 'admin']),
  firstName: personName,
  lastName: personName,
  phone: sgPhone.optional(),
  branchIds: z.array(uuid).default([]),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  firstName: personName,
  lastName: personName,
  phone: sgPhone.nullable(),
}).partial().refine(o => Object.keys(o).length > 0, 'No fields to update');
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const setStaffBranchesSchema = z.object({ branchIds: z.array(uuid) });

export const staffListQuery = z.object({
  role: z.enum(['tutor', 'branch_manager', 'admin']).optional(),
  includeArchived: z.stringbool().default(false),
});

export const includeArchivedQuery = z.object({ includeArchived: z.stringbool().default(false) });