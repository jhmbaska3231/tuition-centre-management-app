// backend/src/http/middleware/error-handler.ts
//
// the only place that turns errors into http responses. express 5 forwards rejected
// promises from async handlers here automatically, so no wrapper is needed

import { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { config } from '../../config';
import { isExclusionViolation, isForeignKeyViolation, isStatementTimeout, isUniqueViolation } from '../../db';
import { AppError, NotFoundError } from '../errors';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

const send = (res: Response, req: Request, status: number, code: string, message: string, details?: unknown): void => {
  const body: ErrorBody = { error: { code, message, requestId: req.id } };
  if (details !== undefined) body.error.details = details;
  res.status(status).json(body);
};

const formatIssues = (issues: z.core.$ZodIssue[]) =>
  issues.map(i => ({ path: i.path.map(String).join('.'), message: i.message }));

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError('Route'));
};

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  if (res.headersSent) return;

  // errors thrown on purpose by services and middleware
  if (err instanceof AppError) {
    send(res, req, err.status, err.code, err.message, err.details);
    return;
  }

  if (err instanceof ZodError) {
    send(res, req, 400, 'validation_error', 'Invalid request', formatIssues(err.issues));
    return;
  }

  // body parser problems: malformed json, payload too large
  const anyErr = err as any;
  if (anyErr?.type === 'entity.parse.failed') {
    send(res, req, 400, 'malformed_json', 'Request body is not valid JSON');
    return;
  }
  if (anyErr?.type === 'entity.too.large') {
    send(res, req, 413, 'payload_too_large', 'Request body is too large');
    return;
  }

  // database constraints the service did not translate itself. these are safe generic
  // messages, services should catch and re throw with specifics where it matters
  if (isUniqueViolation(err)) {
    send(res, req, 409, 'conflict', 'A record with those details already exists');
    return;
  }
  if (isExclusionViolation(err)) {
    send(res, req, 409, 'schedule_conflict', 'That time slot overlaps an existing session');
    return;
  }
  if (isForeignKeyViolation(err)) {
    send(res, req, 400, 'invalid_reference', 'A referenced record does not exist or is still in use');
    return;
  }
  if (isStatementTimeout(err)) {
    send(res, req, 503, 'timeout', 'The request took too long, please try again');
    return;
  }

  // everything else is a bug, log it fully
  console.error(JSON.stringify({
    level: 'error',
    msg: 'unhandled_error',
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
  }));

  send(res, req, 500, 'internal_error',
    config.isDevelopment && err instanceof Error ? err.message : 'Something went wrong');
};