// backend/src/types/express.d.ts
//
// augments express's request with the properties the middleware attaches
// kept in one file so every entry point (api, worker, jobs) sees the same shape

import type { AuthUser } from '../modules/auth/types';
import type { Validated } from '../http/middleware/validate';

declare global {
  namespace Express {
    interface Request {
      id: string;
      validated: Validated<any, any, any>;
      user?: AuthUser;
    }
  }
}

export {};