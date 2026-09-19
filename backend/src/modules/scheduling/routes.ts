// backend/src/modules/scheduling/routes.ts

import { Router } from 'express';
import { z } from 'zod';
import { idParam, uuid, validate } from '../../http/middleware/validate';
import { authenticate, authorise, currentUser } from '../auth/middleware';
import * as s from './schemas';
import * as service from './service';

const staffWrite = authorise('admin', 'branch_manager');

export const termsRouter = Router();
termsRouter.use(authenticate);
termsRouter.get('/', async (req, res) => { res.json(await service.listTerms(currentUser(req).orgId)); });
termsRouter.post('/', authorise('admin'), validate({ body: s.createTermSchema }), async (req, res) => { res.status(201).json(await service.createTerm(currentUser(req), req.validated.body)); });
termsRouter.patch('/:id', authorise('admin'), validate({ params: idParam, body: s.updateTermSchema }), async (req, res) => { res.json(await service.updateTerm(currentUser(req), req.validated.params.id, req.validated.body)); });
termsRouter.post('/:id/archive', authorise('admin'), validate({ params: idParam }), async (req, res) => { res.json(await service.archiveTerm(currentUser(req), req.validated.params.id)); });

export const coursesRouter = Router();
coursesRouter.use(authenticate);
coursesRouter.get('/', validate({ query: s.listCoursesQuery }), async (req, res) => { res.json(await service.listCourses(currentUser(req), req.validated.query)); });
coursesRouter.post('/', staffWrite, validate({ body: s.createCourseSchema }), async (req, res) => { res.status(201).json(await service.createCourse(currentUser(req), req.validated.body)); });
coursesRouter.get('/:id', validate({ params: idParam }), async (req, res) => { res.json(await service.getCourse(currentUser(req), req.validated.params.id)); });
coursesRouter.patch('/:id', staffWrite, validate({ params: idParam, body: s.updateCourseSchema }), async (req, res) => { res.json(await service.updateCourse(currentUser(req), req.validated.params.id, req.validated.body)); });
coursesRouter.post('/:id/status', staffWrite, validate({ params: idParam, body: s.courseStatusSchema }), async (req, res) => { res.json(await service.setCourseStatus(currentUser(req), req.validated.params.id, req.validated.body.status)); });
coursesRouter.post('/:id/slots', staffWrite, validate({ params: idParam, body: s.slotSchema }), async (req, res) => { res.status(201).json(await service.addSlot(currentUser(req), req.validated.params.id, req.validated.body)); });
coursesRouter.delete('/:id/slots/:slotId', staffWrite, validate({ params: z.object({ id: uuid, slotId: uuid }) }), async (req, res) => { res.json(await service.removeSlot(currentUser(req), req.validated.params.id, req.validated.params.slotId)); });
coursesRouter.post('/:id/generate', staffWrite, validate({ params: idParam }), async (req, res) => { res.json(await service.regenerate(currentUser(req), req.validated.params.id)); });

export const sessionsRouter = Router();
sessionsRouter.use(authenticate);
sessionsRouter.get('/', validate({ query: s.listSessionsQuery }), async (req, res) => { res.json(await service.listSessions(currentUser(req), req.validated.query)); });
sessionsRouter.get('/needing-cover', staffWrite, async (req, res) => { res.json(await service.listNeedingCover(currentUser(req))); });
sessionsRouter.post('/', staffWrite, validate({ body: s.createAdhocSessionSchema }), async (req, res) => { res.status(201).json(await service.createAdhocSession(currentUser(req), req.validated.body)); });
sessionsRouter.get('/:id', validate({ params: idParam }), async (req, res) => { res.json(await service.getSession(currentUser(req), req.validated.params.id)); });
sessionsRouter.patch('/:id', staffWrite, validate({ params: idParam, body: s.rescheduleSessionSchema }), async (req, res) => { res.json(await service.rescheduleSession(currentUser(req), req.validated.params.id, req.validated.body)); });
sessionsRouter.post('/:id/cancel', staffWrite, validate({ params: idParam, body: s.cancelSessionSchema }), async (req, res) => { res.json(await service.cancelSession(currentUser(req), req.validated.params.id, req.validated.body.reason)); });
sessionsRouter.post('/:id/cover', staffWrite, validate({ params: idParam, body: s.assignCoverSchema }), async (req, res) => { res.json(await service.assignCover(currentUser(req), req.validated.params.id, req.validated.body.tutor_id)); });
sessionsRouter.patch('/:id/notes', authorise('tutor', 'admin', 'branch_manager'), validate({ params: idParam, body: s.sessionNotesSchema }), async (req, res) => { res.json(await service.setSessionNotes(currentUser(req), req.validated.params.id, req.validated.body)); });

export const tutorsRouter = Router();
tutorsRouter.use(authenticate);
tutorsRouter.get('/:id/availability', validate({ params: idParam }), async (req, res) => { res.json(await service.getAvailability(currentUser(req), req.validated.params.id)); });
tutorsRouter.put('/:id/availability', validate({ params: idParam, body: s.availabilitySchema }), async (req, res) => { res.json(await service.setAvailability(currentUser(req), req.validated.params.id, req.validated.body.slots)); });

export const leaveRouter = Router();
leaveRouter.use(authenticate);
leaveRouter.get('/', validate({ query: s.listLeaveQuery }), async (req, res) => { res.json(await service.listLeave(currentUser(req), req.validated.query)); });
leaveRouter.post('/', validate({ body: s.createLeaveSchema }), async (req, res) => { res.status(201).json(await service.requestLeave(currentUser(req), req.validated.body)); });
leaveRouter.post('/:id/decide', staffWrite, validate({ params: idParam, body: s.decideLeaveSchema }), async (req, res) => { res.json(await service.decideLeave(currentUser(req), req.validated.params.id, req.validated.body.decision, req.validated.body.note)); });
leaveRouter.post('/:id/cancel', validate({ params: idParam }), async (req, res) => { res.json(await service.cancelLeave(currentUser(req), req.validated.params.id)); });