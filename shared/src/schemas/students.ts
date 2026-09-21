// shared/src/schemas/students.ts

import { z } from 'zod';
import { RELATIONSHIPS } from '../enums';
import { email, isoDate, personName, uuid } from '../primitives';

const relationship = z.enum(RELATIONSHIPS);

const studentFields = {
  firstName: personName,
  lastName: personName,
  levelId: uuid.nullable(),
  dateOfBirth: isoDate.nullable(),
  school: z.string().trim().max(100).nullable(),
  homeBranchId: uuid.nullable(),
  notes: z.string().trim().max(2000).nullable(),
};

// parent adding their own child. the caller becomes the guardian and billing contact.
// levelid is required so course browsing works immediately
export const createOwnStudentSchema = z.object({
  ...studentFields,
  levelId: uuid,
  dateOfBirth: isoDate.nullable().default(null),
  school: studentFields.school.default(null),
  homeBranchId: studentFields.homeBranchId.default(null),
  notes: studentFields.notes.default(null),
  relationship,
});
export type CreateOwnStudentInput = z.infer<typeof createOwnStudentSchema>;

// staff creating a student for a parent who already has an account
export const createStudentSchema = z.object({
  ...studentFields,
  dateOfBirth: isoDate.nullable().default(null),
  school: studentFields.school.default(null),
  homeBranchId: studentFields.homeBranchId.default(null),
  notes: studentFields.notes.default(null),
  guardian: z.object({ userId: uuid, relationship }),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z.object(studentFields).partial()
  .refine(o => Object.keys(o).length > 0, 'No fields to update');
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export const addGuardianSchema = z.object({
  email,
  relationship,
  isBillingContact: z.boolean().default(false),
  receivesNotifications: z.boolean().default(true),
});
export type AddGuardianInput = z.infer<typeof addGuardianSchema>;

export const updateGuardianSchema = z.object({
  relationship: relationship.optional(),
  isBillingContact: z.boolean().optional(),
  receivesNotifications: z.boolean().optional(),
}).refine(o => Object.keys(o).length > 0, 'No fields to update');
export type UpdateGuardianInput = z.infer<typeof updateGuardianSchema>;

export const guardianParams = z.object({ id: uuid, userId: uuid });

export const listStudentsQuery = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  levelId: uuid.optional(),
  branchId: uuid.optional(),
  includeArchived: z.stringbool().default(false),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});