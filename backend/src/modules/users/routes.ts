// backend/src/modules/users/routes.ts

import { Request, Router } from 'express';
import { validate } from '../../http/middleware/validate';
import { authenticate, authorise, currentUser } from '../auth/middleware';
import * as s from './schemas';
import * as service from './service';

const ip = (req: Request) => req.ip ?? null;

export const accountRouter = Router();
accountRouter.use(authenticate);
accountRouter.patch('/profile', validate({ body: s.updateProfileSchema }), async (req, res) => { res.json({ user: await service.updateMyProfile(currentUser(req), req.validated.body, ip(req)) }); });
accountRouter.post('/password', validate({ body: s.changePasswordSchema }), async (req, res) => {
  const { currentPassword, newPassword } = req.validated.body;
  await service.changeMyPassword(currentUser(req), currentPassword, newPassword, ip(req));
  // all sessions are gone, the client must log in again
  res.status(204).end();
});
accountRouter.delete('/', authorise('parent'), validate({ body: s.deleteAccountSchema }), async (req, res) => {
  res.json(await service.deleteMyAccount(currentUser(req), req.validated.body.password, ip(req)));
});

export const parentsRouter = Router();
parentsRouter.use(authenticate, authorise('admin', 'branch_manager', 'tutor'));
parentsRouter.get('/', validate({ query: s.listParentsQuery }), async (req, res) => { res.json(await service.listParents(currentUser(req), req.validated.query)); });
parentsRouter.post('/', authorise('admin', 'branch_manager'), validate({ body: s.createParentSchema }), async (req, res) => { res.status(201).json(await service.createParent(currentUser(req), req.validated.body, ip(req))); });
parentsRouter.get('/:id', validate({ params: s.parentIdParam }), async (req, res) => { res.json(await service.getParent(currentUser(req), req.validated.params.id)); });
parentsRouter.patch('/:id', authorise('admin', 'branch_manager'), validate({ params: s.parentIdParam, body: s.updateParentSchema }), async (req, res) => { res.json(await service.updateParent(currentUser(req), req.validated.params.id, req.validated.body, ip(req))); });