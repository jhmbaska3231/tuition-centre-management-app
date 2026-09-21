// frontend/src/api/errors.ts

import type { ApiErrorCode, ValidationIssue } from '@tuition/shared';

// thrown by the api client for any non 2xx response. carries the backend's structured
// error contract so screens can switch on code rather than parse message strings
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;
  readonly requestId: string;

  constructor(status: number, code: ApiErrorCode, message: string, requestId: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }

  // field level issues from a 400, ready to feed into react-hook-form's seterror.
  // paths arrive prefixed with the request part e.g. "body.email" > "email"
  get fieldErrors(): Record<string, string> {
    if (this.code !== 'validation_error' || !Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const issue of this.details as ValidationIssue[]) {
      const field = issue.path.replace(/^(body|params|query)\./, '');
      if (field && !out[field]) out[field] = issue.message;
    }
    return out;
  }

  // true when retrying the same request could plausibly succeed
  get isTransient(): boolean {
    return this.status >= 500 || this.code === 'timeout' || this.code === 'rate_limited';
  }
}

// network failure, offline, request aborted. distinct from an http error response
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Could not reach the server. Check your connection and try again.');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError;

export const errorMessage = (err: unknown): string => {
  if (err instanceof ApiError || err instanceof NetworkError) return err.message;
  return 'Something went wrong. Please try again.';
};