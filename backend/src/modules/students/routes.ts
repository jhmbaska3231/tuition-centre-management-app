// backend/src/modules/students/routes.ts

import { Router } from 'express';
import { idParam, validate } from '../../http/middleware/validate';
import { authenticate, authorise, currentUser } from '../auth/middleware';
import * as s from './schemas';
import * as service from './service';

export const studentsRouter = Router();

studentsRouter.use(authenticate);

// staff views
studentsRouter.get('/', authorise('admin', 'branch_manager', 'tutor'), validate({ query: s.listStudentsQuery }), async (req, res) => {
  res.json(await service.listStudents(currentUser(req), req.validated.query));
});
studentsRouter.post('/', authorise('admin', 'branch_manager'), validate({ body: s.createStudentSchema }), async (req, res) => {
  res.status(201).json(await service.createStudent(currentUser(req), req.validated.body));
});

// parent self service. declared before /:id so "mine" is not parsed as an id
studentsRouter.get('/mine', authorise('parent'), async (req, res) => {
  res.json(await service.listMyStudents(currentUser(req)));
});
studentsRouter.post('/mine', authorise('parent'), validate({ body: s.createOwnStudentSchema }), async (req, res) => {
  res.status(201).json(await service.createOwnStudent(currentUser(req), req.validated.body));
});

// shared: access is decided in the service per caller
studentsRouter.get('/:id', validate({ params: idParam }), async (req, res) => {
  res.json(await service.getStudent(currentUser(req), req.validated.params.id));
});
studentsRouter.patch('/:id', validate({ params: idParam, body: s.updateStudentSchema }), async (req, res) => {
  res.json(await service.updateStudent(currentUser(req), req.validated.params.id, req.validated.body));
});
studentsRouter.post('/:id/archive', validate({ params: idParam }), async (req, res) => {
  res.json(await service.archiveStudent(currentUser(req), req.validated.params.id));
});
studentsRouter.post('/:id/restore', authorise('admin', 'branch_manager'), validate({ params: idParam }), async (req, res) => {
  res.json(await service.restoreStudent(currentUser(req), req.validated.params.id));
});

studentsRouter.post('/:id/guardians', validate({ params: idParam, body: s.addGuardianSchema }), async (req, res) => {
  res.status(201).json(await service.addGuardian(currentUser(req), req.validated.params.id, req.validated.body));
});
studentsRouter.patch('/:id/guardians/:userId', validate({ params: s.guardianParams, body: s.updateGuardianSchema }), async (req, res) => {
  const { id, userId } = req.validated.params;
  res.json(await service.updateGuardian(currentUser(req), id, userId, req.validated.body));
});
studentsRouter.delete('/:id/guardians/:userId', validate({ params: s.guardianParams }), async (req, res) => {
  const { id, userId } = req.validated.params;
  res.json(await service.removeGuardian(currentUser(req), id, userId));
});