// backend/src/http/errors.ts

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request', details?: unknown) {
    super(400, 'validation_error', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'unauthorized', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to do that') {
    super(403, 'forbidden', message);
  }
}

export class NotFoundError extends AppError {
  constructor(entity = 'Resource') {
    super(404, 'not_found', `${entity} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, 'conflict', message, details);
  }
}

// a business rule refused the request (class full, past session, capacity below enrollment)
export class RuleViolationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, 'rule_violation', message, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super(429, 'rate_limited', message);
  }
}