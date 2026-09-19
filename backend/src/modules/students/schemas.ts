// backend/src/modules/students/schemas.ts

import { z } from 'zod';
import { isoDate, uuid } from '../../http/middleware/validate';

const personName = z.string().trim().min(1).max(50).regex(/^[A-Za-z][A-Za-z' -]*$/, 'Letters, spaces, hyphens and apostrophes only');
const relationship = z.enum(['mother', 'father', 'guardian']);

const studentFields = {
  firstName: personName,
  lastName: personName,
  levelId: uuid.nullable(),
  dateOfBirth: isoDate.nullable(),
  school: z.string().trim().max(100).nullable(),
  homeBranchId: uuid.nullable(),
  notes: z.string().trim().max(2000).nullable(),
};

// parent adding their own child, guardian is the caller
export const createOwnStudentSchema = z.object({
  ...studentFields,
  relationship,
  levelId: uuid,  // required for own children so browsing works immediately
  dateOfBirth: isoDate.nullable().default(null),
  school: studentFields.school.default(null),
  homeBranchId: studentFields.homeBranchId.default(null),
  notes: studentFields.notes.default(null),
});

// staff creating a student on behalf of a parent who already has an account
export const createStudentSchema = z.object({
  ...studentFields,
  dateOfBirth: isoDate.nullable().default(null),
  school: studentFields.school.default(null),
  homeBranchId: studentFields.homeBranchId.default(null),
  notes: studentFields.notes.default(null),
  guardian: z.object({ userId: uuid, relationship }),
});

export const updateStudentSchema = z.object(studentFields).partial()
  .refine(o => Object.keys(o).length > 0, 'No fields to update');

export const addGuardianSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  relationship,
  isBillingContact: z.boolean().default(false),
  receivesNotifications: z.boolean().default(true),
});

export const updateGuardianSchema = z.object({
  relationship: relationship.optional(),
  isBillingContact: z.boolean().optional(),
  receivesNotifications: z.boolean().optional(),
}).refine(o => Object.keys(o).length > 0, 'No fields to update');

export const guardianParams = z.object({ id: uuid, userId: uuid });

export const listStudentsQuery = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  levelId: uuid.optional(),
  branchId: uuid.optional(),
  includeArchived: z.stringbool().default(false),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});