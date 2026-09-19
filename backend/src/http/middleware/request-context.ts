// backend/src/http/middleware/request-context.ts
//
// assigns a request id and logs one structured line per request on completion

import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { config } from '../../config';

export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  // honor an upstream id (ingress controllers often set one) so logs correlate end to end
  const incoming = req.get('x-request-id');
  req.id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const line = {
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      msg: 'request',
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      ip: req.ip,
      userId: (req as any).user?.id ?? null,
    };
    if (config.logLevel === 'debug' || line.level !== 'info') {
      console.log(JSON.stringify(line));
    }
  });

  next();
};