// backend/src/modules/enrollment/routes.ts

import { Router } from 'express';
import { idParam, validate } from '../../http/middleware/validate';
import { authenticate, authorise, currentUser } from '../auth/middleware';
import * as s from './schemas';
import * as service from './service';

export const enrollmentsRouter = Router();
enrollmentsRouter.use(authenticate);
enrollmentsRouter.get('/', validate({ query: s.listEnrollmentsQuery }), async (req, res) => { res.json(await service.listEnrollments(currentUser(req), req.validated.query)); });
enrollmentsRouter.post('/', authorise('parent', 'admin', 'branch_manager'), validate({ body: s.enrollSchema }), async (req, res) => { res.status(201).json(await service.enroll(currentUser(req), req.validated.body)); });
enrollmentsRouter.get('/:id', validate({ params: idParam }), async (req, res) => { res.json(await service.getEnrollment(currentUser(req), req.validated.params.id)); });
enrollmentsRouter.get('/:id/attendance', validate({ params: idParam }), async (req, res) => { res.json(await service.attendanceHistory(currentUser(req), req.validated.params.id)); });
enrollmentsRouter.post('/:id/withdraw', authorise('parent', 'admin', 'branch_manager'), validate({ params: idParam, body: s.withdrawSchema }), async (req, res) => { res.json(await service.withdraw(currentUser(req), req.validated.params.id, req.validated.body)); });

export const waitlistRouter = Router();
waitlistRouter.use(authenticate, authorise('parent', 'admin', 'branch_manager'));
waitlistRouter.get('/', validate({ query: s.listWaitlistQuery }), async (req, res) => { res.json(await service.listWaitlist(currentUser(req), req.validated.query)); });
waitlistRouter.post('/', validate({ body: s.joinWaitlistSchema }), async (req, res) => { res.status(201).json(await service.joinWaitlist(currentUser(req), req.validated.body)); });
waitlistRouter.post('/:id/accept', validate({ params: idParam }), async (req, res) => { res.status(201).json(await service.acceptOffer(currentUser(req), req.validated.params.id)); });
waitlistRouter.post('/:id/withdraw', validate({ params: idParam }), async (req, res) => { res.json(await service.leaveWaitlist(currentUser(req), req.validated.params.id)); });

export const attendanceRouter = Router();
attendanceRouter.use(authenticate, authorise('tutor', 'admin', 'branch_manager'));
attendanceRouter.get('/sessions/:sessionId', validate({ params: s.sessionParam }), async (req, res) => { res.json(await service.getRoster(currentUser(req), req.validated.params.sessionId)); });
attendanceRouter.put('/sessions/:sessionId', validate({ params: s.sessionParam, body: s.markAttendanceSchema }), async (req, res) => { res.json(await service.markAttendance(currentUser(req), req.validated.params.sessionId, req.validated.body.records)); });

export const makeupsRouter = Router();
makeupsRouter.use(authenticate, authorise('parent', 'admin', 'branch_manager'));
makeupsRouter.get('/', validate({ query: s.listMakeupsQuery }), async (req, res) => { res.json(await service.listMakeups(currentUser(req), req.validated.query)); });
makeupsRouter.get('/:id/options', validate({ params: idParam }), async (req, res) => { res.json(await service.makeupOptions(currentUser(req), req.validated.params.id)); });
makeupsRouter.post('/:id/book', validate({ params: idParam, body: s.bookMakeupSchema }), async (req, res) => { res.json(await service.bookMakeup(currentUser(req), req.validated.params.id, req.validated.body.sessionId)); });
makeupsRouter.post('/:id/unbook', validate({ params: idParam }), async (req, res) => { res.json(await service.unbookMakeup(currentUser(req), req.validated.params.id)); });