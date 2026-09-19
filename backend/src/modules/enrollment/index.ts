// backend/src/modules/enrollment/index.ts

import { attendanceRouter, enrollmentsRouter, makeupsRouter, waitlistRouter } from './routes';

export { releaseMakeupsForSession, offerNextIfSeat, runLifecycleJob } from './service';

export const enrollmentRouters = [
  { path: '/api/enrollments', router: enrollmentsRouter },
  { path: '/api/waitlist', router: waitlistRouter },
  { path: '/api/attendance', router: attendanceRouter },
  { path: '/api/makeups', router: makeupsRouter },
];