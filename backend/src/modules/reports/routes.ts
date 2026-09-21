// backend/src/modules/reports/routes.ts

import { Router } from 'express';
import { reportRangeQuery } from '@tuition/shared';
import { pool } from '../../db';
import { validate } from '../../http/middleware/validate';
import { addDays, todayIn } from '../../lib/time';
import { authenticate, authorise, currentUser } from '../auth/middleware';
import type { AuthUser } from '../auth/types';
import * as orgRepository from '../org/repository';
import * as repo from './repository';

const scope = (u: AuthUser) => (u.role === 'admin' ? null : u.branchIds);
const defaultRange = async (orgId: string, f: { from?: string; to?: string }) => {
  const today = todayIn((await orgRepository.findOrganisation(pool, orgId)).timezone);
  return { from: f.from ?? addDays(today, -180), to: f.to ?? today };
};

export const reportsRouter = Router();
reportsRouter.use(authenticate, authorise('admin', 'branch_manager'));
reportsRouter.get('/overview', async (req, res) => { const u = currentUser(req); res.json(await repo.overview(pool, u.orgId, scope(u))); });
reportsRouter.get('/course-fill', async (req, res) => { const u = currentUser(req); res.json(await repo.courseFill(pool, u.orgId, scope(u))); });
reportsRouter.get('/enrollment-breakdown', async (req, res) => { const u = currentUser(req); res.json(await repo.enrollmentBreakdown(pool, u.orgId, scope(u))); });
reportsRouter.get('/revenue', authorise('admin'), validate({ query: reportRangeQuery }), async (req, res) => {
  const u = currentUser(req); const r = await defaultRange(u.orgId, req.validated.query);
  res.json(await repo.revenueByMonth(pool, u.orgId, r.from, r.to));
});
reportsRouter.get('/attendance', validate({ query: reportRangeQuery }), async (req, res) => {
  const u = currentUser(req); const r = await defaultRange(u.orgId, req.validated.query);
  res.json(await repo.attendanceByCourse(pool, u.orgId, r.from, r.to, scope(u)));
});
reportsRouter.get('/tutor-workload', validate({ query: reportRangeQuery }), async (req, res) => {
  const u = currentUser(req); const r = await defaultRange(u.orgId, req.validated.query);
  res.json(await repo.tutorWorkload(pool, u.orgId, r.from, r.to));
});
reportsRouter.get('/churn', validate({ query: reportRangeQuery }), async (req, res) => {
  const u = currentUser(req); const r = await defaultRange(u.orgId, req.validated.query);
  res.json(await repo.churn(pool, u.orgId, r.from, r.to));
});