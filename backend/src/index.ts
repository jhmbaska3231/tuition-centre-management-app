// backend/src/index.ts

import { createApp } from './http/app';
import { startServer } from './http/server';
import { auditRouter } from './modules/audit';
import { authRouter } from './modules/auth';
import { billingRouters } from './modules/billing';
import { enrollmentRouters } from './modules/enrollment';
import { notificationsRouter } from './modules/notifications';
import { orgRouters } from './modules/org';
import { reportsRouter } from './modules/reports';
import { schedulingRouters } from './modules/scheduling';
import { studentsRouter } from './modules/students';
import { usersRouters } from './modules/users';

const app = createApp([
  { path: '/api/auth', router: authRouter },
  ...orgRouters,
  ...usersRouters,
  { path: '/api/students', router: studentsRouter },
  ...schedulingRouters,
  ...enrollmentRouters,
  ...billingRouters,
  { path: '/api/notifications', router: notificationsRouter },
  { path: '/api/reports', router: reportsRouter },
  { path: '/api/audit', router: auditRouter },
]);

startServer(app);