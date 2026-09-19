// backend/src/modules/auth/routes.ts

import { Request, Response, Router } from 'express';
import { config } from '../../config';
import { authLimiter } from '../../http/middleware/rate-limit';
import { validate } from '../../http/middleware/validate';
import { authenticate, currentUser } from './middleware';
import { loginSchema, passwordResetConfirmSchema, passwordResetRequestSchema, registerSchema } from './schemas';
import * as service from './service';

export const authRouter = Router();

const meta = (req: Request) => ({ ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null });

const setRefreshCookie = (res: Response, token: string, expiresAt: Date): void => {
  res.cookie(config.auth.refreshCookie.name, token, { ...config.auth.refreshCookie, expires: expiresAt });
};

const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(config.auth.refreshCookie.name, { ...config.auth.refreshCookie });
};

const readRefreshCookie = (req: Request): string | undefined => req.cookies?.[config.auth.refreshCookie.name];

const respondWithSession = (res: Response, status: number, s: service.IssuedSession): void => {
  setRefreshCookie(res, s.refreshToken, s.refreshExpiresAt);
  res.status(status).json({ accessToken: s.accessToken, user: s.user });
};

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), async (req, res) => {
  const session = await service.register(req.validated.body, meta(req));
  respondWithSession(res, 201, session);
});

authRouter.post('/login', authLimiter, validate({ body: loginSchema }), async (req, res) => {
  const session = await service.login(req.validated.body, meta(req));
  respondWithSession(res, 200, session);
});

authRouter.post('/refresh', async (req, res) => {
  const token = readRefreshCookie(req);
  if (!token) {
    res.status(401).json({ error: { code: 'unauthorized', message: 'No session', requestId: req.id } });
    return;
  }
  try {
    const session = await service.refresh(token, meta(req));
    respondWithSession(res, 200, session);
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
});

authRouter.post('/logout', async (req, res) => {
  await service.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  res.status(204).end();
});

authRouter.post('/logout-all', authenticate, async (req, res) => {
  const user = currentUser(req);
  await service.logoutAll(user.orgId, user.id, meta(req));
  clearRefreshCookie(res);
  res.status(204).end();
});

authRouter.get('/me', authenticate, async (req, res) => {
  const user = currentUser(req);
  res.json({ user: await service.me(user.orgId, user.id) });
});

authRouter.post('/password-reset/request', authLimiter, validate({ body: passwordResetRequestSchema }), async (req, res) => {
  await service.requestPasswordReset(req.validated.body.email, meta(req));
  res.status(202).json({ message: 'If that email is registered, a reset link has been sent' });
});

authRouter.post('/password-reset/confirm', authLimiter, validate({ body: passwordResetConfirmSchema }), async (req, res) => {
  await service.confirmPasswordReset(req.validated.body.token, req.validated.body.password, meta(req));
  res.status(204).end();
});