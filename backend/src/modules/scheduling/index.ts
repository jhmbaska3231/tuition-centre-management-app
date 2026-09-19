// backend/src/modules/scheduling/index.ts

import { coursesRouter, leaveRouter, sessionsRouter, termsRouter, tutorsRouter } from './routes';

export { applyClosure } from './service';
export { generateForAllOpenCourses, generateForCourse } from './generator';
export * as schedulingRepository from './repository';

export const schedulingRouters = [
  { path: '/api/terms', router: termsRouter },
  { path: '/api/courses', router: coursesRouter },
  { path: '/api/sessions', router: sessionsRouter },
  { path: '/api/tutors', router: tutorsRouter },
  { path: '/api/leave', router: leaveRouter },
];