// backend/src/http/middleware/rate-limit.ts

import rateLimit from 'express-rate-limit';
import { config } from '../../config';

const { windowMs, generalMax, authMax } = config.http.rateLimit;

// applied to everything under /api. keyed by client ip, which is only correct because
// app.set('trust proxy', config.http.trustproxyhops) runs before this
export const generalLimiter = rateLimit({
  windowMs,
  limit: generalMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many requests, please try again later' } },
});

// applied only to credential endpoints: login, register, password reset request
// not to /auth/me or /auth/refresh, which every page load hits
export const authLimiter = rateLimit({
  windowMs,
  limit: authMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: { code: 'rate_limited', message: 'Too many attempts, please try again later' } },
});