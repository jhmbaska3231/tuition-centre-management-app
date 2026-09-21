// backend/src/modules/org/routes.ts

import { Request, Router } from 'express';
import { idParam, validate } from '../../http/middleware/validate';
import { authenticate, authorise, currentUser } from '../auth/middleware';
import { getCurrentOrgId } from './current-org';
import {
  createBranchSchema, createClassroomSchema, createClosureSchema, createLevelSchema,
  createStaffSchema, createSubjectSchema, closureRangeQuery, eventKeyParam,
  includeArchivedQuery, integrationKindParam, setStaffBranchesSchema, staffListQuery,
  toggleEventSchema, updateBranchSchema, updateClassroomSchema, updateLevelSchema,
  updateSettingsSchema, updateStaffSchema, updateSubjectSchema, upsertIntegrationSchema,
} from '@tuition/shared';
import * as service from './service';

const ip = (req: Request) => req.ip ?? null;
const admin = [authenticate, authorise('admin')] as const;
const adminOrManager = [authenticate, authorise('admin', 'branch_manager')] as const;

// /api/org ----------------------------------------------------------------------
export const orgRouter = Router();

// unauthenticated: the sign in and landing pages show the centre's name
orgRouter.get('/public', async (_req, res) => {
  res.json(await service.getPublicOrganisation(await getCurrentOrgId()));
});
orgRouter.get('/', authenticate, async (req, res) => {
  res.json(await service.getOrganisation(currentUser(req).orgId));
});
orgRouter.patch('/settings', ...admin, validate({ body: updateSettingsSchema }), async (req, res) => {
  res.json(await service.updateSettings(currentUser(req), req.validated.body));
});
orgRouter.get('/notification-events', ...admin, async (req, res) => {
  res.json(await service.listEventSettings(currentUser(req).orgId));
});
orgRouter.put('/notification-events/:eventKey', ...admin, validate({ params: eventKeyParam, body: toggleEventSchema }), async (req, res) => {
  res.json(await service.toggleEvent(currentUser(req), req.validated.params.eventKey, req.validated.body.enabled));
});
orgRouter.get('/integrations', ...admin, async (req, res) => {
  res.json(await service.listIntegrations(currentUser(req).orgId));
});
orgRouter.put('/integrations/:kind', ...admin, validate({ params: integrationKindParam, body: upsertIntegrationSchema }), async (req, res) => {
  res.json(await service.upsertIntegration(currentUser(req), req.validated.params.kind, req.validated.body));
});
orgRouter.delete('/integrations/:kind', ...admin, validate({ params: integrationKindParam }), async (req, res) => {
  await service.removeIntegration(currentUser(req), req.validated.params.kind);
  res.status(204).end();
});

// /api/branches ----------------------------------------------------------------------
export const branchesRouter = Router();

// public: the registration and browse pages list branches before login
branchesRouter.get('/', async (_req, res) => {
  res.json(await service.listBranches(await getCurrentOrgId(), false));
});
branchesRouter.get('/all', ...admin, validate({ query: includeArchivedQuery }), async (req, res) => {
  res.json(await service.listBranches(currentUser(req).orgId, req.validated.query.includeArchived));
});
branchesRouter.post('/', ...admin, validate({ body: createBranchSchema }), async (req, res) => {
  res.status(201).json(await service.createBranch(currentUser(req), req.validated.body));
});
branchesRouter.patch('/:id', ...admin, validate({ params: idParam, body: updateBranchSchema }), async (req, res) => {
  res.json(await service.updateBranch(currentUser(req), req.validated.params.id, req.validated.body));
});
branchesRouter.post('/:id/archive', ...admin, validate({ params: idParam }), async (req, res) => {
  res.json(await service.archiveBranch(currentUser(req), req.validated.params.id));
});
branchesRouter.get('/:id/classrooms', authenticate, validate({ params: idParam, query: includeArchivedQuery }), async (req, res) => {
  res.json(await service.listClassrooms(currentUser(req), req.validated.params.id, req.validated.query.includeArchived));
});
branchesRouter.post('/:id/classrooms', ...adminOrManager, validate({ params: idParam, body: createClassroomSchema }), async (req, res) => {
  res.status(201).json(await service.createClassroom(currentUser(req), req.validated.params.id, req.validated.body));
});

// /api/classrooms ----------------------------------------------------------------------
export const classroomsRouter = Router();

classroomsRouter.patch('/:id', ...adminOrManager, validate({ params: idParam, body: updateClassroomSchema }), async (req, res) => {
  res.json(await service.updateClassroom(currentUser(req), req.validated.params.id, req.validated.body));
});
classroomsRouter.post('/:id/archive', ...adminOrManager, validate({ params: idParam }), async (req, res) => {
  res.json(await service.archiveClassroom(currentUser(req), req.validated.params.id));
});

// /api/closures ----------------------------------------------------------------------
export const closuresRouter = Router();

closuresRouter.get('/', authenticate, validate({ query: closureRangeQuery }), async (req, res) => {
  res.json(await service.listClosures(currentUser(req).orgId, req.validated.query.from, req.validated.query.to));
});
closuresRouter.post('/', ...adminOrManager, validate({ body: createClosureSchema }), async (req, res) => {
  res.status(201).json(await service.createClosure(currentUser(req), req.validated.body));
});
closuresRouter.delete('/:id', ...adminOrManager, validate({ params: idParam }), async (req, res) => {
  await service.deleteClosure(currentUser(req), req.validated.params.id);
  res.status(204).end();
});

// /api/levels and /api/subjects ----------------------------------------------------------------------
export const levelsRouter = Router();

levelsRouter.get('/', async (_req, res) => {
  res.json(await service.listLevels(await getCurrentOrgId(), false));
});
levelsRouter.post('/', ...admin, validate({ body: createLevelSchema }), async (req, res) => {
  res.status(201).json(await service.createLevel(currentUser(req), req.validated.body));
});
levelsRouter.patch('/:id', ...admin, validate({ params: idParam, body: updateLevelSchema }), async (req, res) => {
  res.json(await service.updateLevel(currentUser(req), req.validated.params.id, req.validated.body));
});
levelsRouter.post('/:id/archive', ...admin, validate({ params: idParam }), async (req, res) => {
  res.json(await service.archiveLevel(currentUser(req), req.validated.params.id));
});

export const subjectsRouter = Router();

subjectsRouter.get('/', async (_req, res) => {
  res.json(await service.listSubjects(await getCurrentOrgId(), false));
});
subjectsRouter.post('/', ...admin, validate({ body: createSubjectSchema }), async (req, res) => {
  res.status(201).json(await service.createSubject(currentUser(req), req.validated.body.name));
});
subjectsRouter.patch('/:id', ...admin, validate({ params: idParam, body: updateSubjectSchema }), async (req, res) => {
  res.json(await service.updateSubject(currentUser(req), req.validated.params.id, req.validated.body.name));
});
subjectsRouter.post('/:id/archive', ...admin, validate({ params: idParam }), async (req, res) => {
  res.json(await service.archiveSubject(currentUser(req), req.validated.params.id));
});

// /api/staff ----------------------------------------------------------------------
export const staffRouter = Router();

staffRouter.get('/', ...adminOrManager, validate({ query: staffListQuery }), async (req, res) => {
  res.json(await service.listStaff(currentUser(req), req.validated.query.role, req.validated.query.includeArchived));
});
staffRouter.post('/', ...admin, validate({ body: createStaffSchema }), async (req, res) => {
  res.status(201).json(await service.createStaff(currentUser(req), req.validated.body, ip(req)));
});
staffRouter.get('/:id', ...adminOrManager, validate({ params: idParam }), async (req, res) => {
  res.json(await service.getStaff(currentUser(req), req.validated.params.id));
});
staffRouter.patch('/:id', ...admin, validate({ params: idParam, body: updateStaffSchema }), async (req, res) => {
  res.json(await service.updateStaff(currentUser(req), req.validated.params.id, req.validated.body));
});
staffRouter.put('/:id/branches', ...admin, validate({ params: idParam, body: setStaffBranchesSchema }), async (req, res) => {
  res.json(await service.setStaffBranches(currentUser(req), req.validated.params.id, req.validated.body.branchIds));
});
staffRouter.post('/:id/archive', ...admin, validate({ params: idParam }), async (req, res) => {
  res.json(await service.archiveStaff(currentUser(req), req.validated.params.id, ip(req)));
});
staffRouter.post('/:id/restore', ...admin, validate({ params: idParam }), async (req, res) => {
  res.json(await service.restoreStaff(currentUser(req), req.validated.params.id, ip(req)));
});