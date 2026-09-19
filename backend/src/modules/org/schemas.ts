// backend/src/modules/org/schemas.ts

import { z } from 'zod';
import { isoDate, uuid } from '../../http/middleware/validate';

const bp = z.number().int().min(0).max(10000);

export const updateSettingsSchema = z.object({
  session_horizon_weeks: z.number().int().min(1).max(52),
  adhoc_min_lead_minutes: z.number().int().min(0),
  adhoc_max_lead_days: z.number().int().min(1),
  travel_buffer_minutes: z.number().int().min(0),
  attendance_edit_window_days: z.number().int().min(0),
  waitlist_offer_hours: z.number().int().min(1),
  makeup_eligible_statuses: z.array(z.enum(['absent', 'late', 'excused'])).min(1),
  makeup_expiry_policy: z.enum(['end_of_term', 'fixed_days']),
  makeup_expiry_days: z.number().int().min(1),
  billing_generation_day: z.number().int().min(1).max(28),
  billing_due_day: z.number().int().min(1).max(28),
  tax_rate_bp: bp,
  sibling_discount_bp: bp,
  invoice_prefix: z.string().trim().min(1).max(10).regex(/^[A-Z0-9-]+$/, 'Uppercase letters, digits and hyphens only'),
}).partial().refine(o => Object.keys(o).length > 0, 'No fields to update');

export const eventKeyParam = z.object({
  eventKey: z.enum(['session_reminder', 'session_cancelled', 'tutor_changed', 'student_absent',
    'invoice_issued', 'invoice_overdue', 'waitlist_offer', 'leave_request_submitted', 'leave_request_decided']),
});
export const toggleEventSchema = z.object({ enabled: z.boolean() });

export const integrationKindParam = z.object({ kind: z.enum(['email', 'sms', 'whatsapp', 'payment']) });
export const upsertIntegrationSchema = z.object({
  provider: z.string().trim().min(1).max(50),
  // provider specific keys (host, port, apiKey, from etc). validated per provider by the
  // notifications module when it connects, here only requires a flat string map
  config: z.record(z.string(), z.string().min(1).max(2000)).refine(c => Object.keys(c).length > 0, 'Config cannot be empty'),
  is_active: z.boolean().default(true),
});

const name = z.string().trim().min(1).max(100);
const sgPhone = z.string().trim().regex(/^\d{8}$/, 'Phone must be exactly 8 digits');

export const createBranchSchema = z.object({ name, address: z.string().trim().min(5).max(200), phone: sgPhone.optional() });
export const updateBranchSchema = createBranchSchema.partial().refine(o => Object.keys(o).length > 0, 'No fields to update');

export const createClassroomSchema = z.object({ name, capacity: z.number().int().min(1).max(500) });
export const updateClassroomSchema = createClassroomSchema.partial().refine(o => Object.keys(o).length > 0, 'No fields to update');

export const createClosureSchema = z.object({
  branch_id: uuid.nullable().default(null),
  starts_on: isoDate,
  ends_on: isoDate,
  reason: z.string().trim().min(1).max(200),
}).refine(c => c.ends_on >= c.starts_on, { path: ['ends_on'], message: 'ends_on must not be before starts_on' });
export const closureRangeQuery = z.object({ from: isoDate.optional(), to: isoDate.optional() });

export const createLevelSchema = z.object({
  code: z.string().trim().min(1).max(10).regex(/^[A-Z0-9]+$/, 'Uppercase letters and digits only'),
  name,
  sort_order: z.number().int().min(0),
});
export const updateLevelSchema = createLevelSchema.partial().refine(o => Object.keys(o).length > 0, 'No fields to update');

export const createSubjectSchema = z.object({ name });
export const updateSubjectSchema = createSubjectSchema;

const personName = z.string().trim().min(1).max(50).regex(/^[A-Za-z][A-Za-z' -]*$/, 'Letters, spaces, hyphens and apostrophes only');

export const createStaffSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(8).max(72),
  role: z.enum(['tutor', 'branch_manager', 'admin']),
  firstName: personName,
  lastName: personName,
  phone: sgPhone.optional(),
  branchIds: z.array(uuid).default([]),
});
export const updateStaffSchema = z.object({
  firstName: personName, lastName: personName, phone: sgPhone.nullable(),
}).partial().refine(o => Object.keys(o).length > 0, 'No fields to update');
export const setStaffBranchesSchema = z.object({ branchIds: z.array(uuid) });
export const staffListQuery = z.object({
  role: z.enum(['tutor', 'branch_manager', 'admin']).optional(),
  includeArchived: z.stringbool().default(false),
});