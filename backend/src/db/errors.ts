// backend/src/db/errors.ts
//
// postgresql reports constraint violations as sqlstate codes on the error object
// services use these helpers to turn a database refusal into a domain response
// (409 duplicate, 409 schedule conflict, 400 invalid reference) without string matching

import { DatabaseError } from 'pg';

const isPgError = (err: unknown): err is DatabaseError =>
  typeof err === 'object' && err !== null && 'code' in err && typeof (err as any).code === 'string';

const hasCode = (err: unknown, code: string, constraint?: string): boolean =>
  isPgError(err) && err.code === code && (constraint === undefined || err.constraint === constraint);

// 23505: unique or unique index, pass the constraint name to check for a specific one
export const isUniqueViolation = (err: unknown, constraint?: string) => hasCode(err, '23505', constraint);

// 23P01: exclue constraint, used by sessions_no_tutor_overlap and sessions_no_classroom_overlap
export const isExclusionViolation = (err: unknown, constraint?: string) => hasCode(err, '23P01', constraint);

// 23503: foreign key, referenced row does not exist, or a row is still referenced on delete
export const isForeignKeyViolation = (err: unknown, constraint?: string) => hasCode(err, '23503', constraint);

// 23514: check constraint, including the enum like status columns
export const isCheckViolation = (err: unknown, constraint?: string) => hasCode(err, '23514', constraint);

// 40001: serialization failure, 40P01 deadlock, both are safe to retry
export const isRetryableTransactionError = (err: unknown) => hasCode(err, '40001') || hasCode(err, '40P01');

// 57014: statement_timeout hit
export const isStatementTimeout = (err: unknown) => hasCode(err, '57014');