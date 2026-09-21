// backend/src/http/middleware/validate.ts
//
// validates and coerces body, params and query with zod. parsed values are attached
// as req.validated. handlers read from there, never from req.body directly
//
// express 5 makes req.query a read-only getter, which is why parsed input lives on
// its own property instead of being written back

import { NextFunction, Request, Response } from 'express';
import { z, ZodType } from 'zod';
import { ValidationError } from '../errors';

interface Schemas<B extends ZodType, P extends ZodType, Q extends ZodType> {
  body?: B;
  params?: P;
  query?: Q;
}

export interface Validated<B = unknown, P = unknown, Q = unknown> {
  body: B;
  params: P;
  query: Q;
}

const formatIssues = (issues: z.core.$ZodIssue[]) =>
  issues.map(i => ({ path: i.path.map(String).join('.'), message: i.message }));

export const validate = <B extends ZodType, P extends ZodType, Q extends ZodType>(schemas: Schemas<B, P, Q>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result: Validated = { body: undefined, params: undefined, query: undefined };
    const issues: z.core.$ZodIssue[] = [];

    for (const part of ['body', 'params', 'query'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const parsed = schema.safeParse(req[part]);
      if (parsed.success) {
        result[part] = parsed.data;
      } else {
        issues.push(...parsed.error.issues.map(i => ({ ...i, path: [part, ...i.path] })));
      }
    }

    if (issues.length > 0) {
      next(new ValidationError('Invalid request', formatIssues(issues)));
      return;
    }

    req.validated = result;
    next();
  };

export { uuid, isoDate, idParam } from '@tuition/shared';