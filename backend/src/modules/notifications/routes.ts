// backend/src/modules/notifications/routes.ts

import { Router } from 'express';
import { z } from 'zod';
import { idParam, uuid, validate } from '../../http/middleware/validate';
import { authenticate, authorise, currentUser } from '../auth/middleware';
import * as service from './service';

const prefSchema = z.object({
  channel: z.enum(['email', 'sms', 'whatsapp']),
  eventKey: z.enum(['session_reminder', 'session_cancelled', 'session_rescheduled', 'tutor_changed', 'student_absent', 'invoice_issued', 'invoice_overdue', 'waitlist_offer', 'leave_request_submitted', 'leave_request_decided']),
  enabled: z.boolean(),
});
const outboxQuery = z.object({
  status: z.enum(['pending', 'sent', 'failed', 'cancelled']).optional(), recipientUserId: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50), offset: z.coerce.number().int().min(0).default(0),
});

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);
notificationsRouter.get('/preferences', async (req, res) => { res.json(await service.listMyPreferences(currentUser(req))); });
notificationsRouter.put('/preferences', validate({ body: prefSchema }), async (req, res) => {
  const { channel, eventKey, enabled } = req.validated.body;
  res.json(await service.setMyPreference(currentUser(req), channel, eventKey, enabled));
});
notificationsRouter.post('/test-email', authorise('admin'), async (req, res) => { res.json(await service.sendTestEmail(currentUser(req))); });
notificationsRouter.get('/outbox', authorise('admin'), validate({ query: outboxQuery }), async (req, res) => { res.json(await service.listOutbox(currentUser(req), req.validated.query)); });
notificationsRouter.post('/outbox/:id/requeue', authorise('admin'), validate({ params: idParam }), async (req, res) => { await service.requeue(currentUser(req), req.validated.params.id); res.status(204).end(); });