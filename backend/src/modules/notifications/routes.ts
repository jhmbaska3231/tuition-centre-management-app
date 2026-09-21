// backend/src/modules/notifications/routes.ts

import { Router } from 'express';
import { notificationPreferenceSchema, outboxQuery } from '@tuition/shared';
import { idParam, validate } from '../../http/middleware/validate';
import { authenticate, authorise, currentUser } from '../auth/middleware';
import * as service from './service';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);
notificationsRouter.get('/preferences', async (req, res) => { res.json(await service.listMyPreferences(currentUser(req))); });
notificationsRouter.put('/preferences', validate({ body: notificationPreferenceSchema }), async (req, res) => {
  const { channel, eventKey, enabled } = req.validated.body;
  res.json(await service.setMyPreference(currentUser(req), channel, eventKey, enabled));
});
notificationsRouter.post('/test-email', authorise('admin'), async (req, res) => { res.json(await service.sendTestEmail(currentUser(req))); });
notificationsRouter.get('/outbox', authorise('admin'), validate({ query: outboxQuery }), async (req, res) => { res.json(await service.listOutbox(currentUser(req), req.validated.query)); });
notificationsRouter.post('/outbox/:id/requeue', authorise('admin'), validate({ params: idParam }), async (req, res) => { await service.requeue(currentUser(req), req.validated.params.id); res.status(204).end(); });