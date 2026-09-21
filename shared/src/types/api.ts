// shared/src/types/api.ts
//
// important: these are not the backend's internal row types. json has no date, so
// every timestamptz column arrives as an iso string and every date column as
// 'yyyy-mm-dd'. need to be explicit about the difference to prevent the frontend
// from accidentally calling .gettime() on a string instead of an actual date object

export type Timestamp = string;  // iso8601 with offset e.g. 2026-09-19t02:00:00.000z
export type DateOnly = string;  // yyyy-mm-dd
export type TimeOnly = string;  // hh:mm:ss
export type Cents = number;  // integer

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

// matches the codes thrown by the backend error handler. switch on these rather than
// parsing message strings
export type ApiErrorCode =
  | 'validation_error'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'schedule_conflict'
  | 'rule_violation'
  | 'rate_limited'
  | 'malformed_json'
  | 'payload_too_large'
  | 'invalid_reference'
  | 'timeout'
  | 'internal_error';

// the details payload for validation_error
export interface ValidationIssue {
  path: string;
  message: string;
}