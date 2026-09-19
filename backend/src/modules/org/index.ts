// backend/src/modules/org/index.ts

import { branchesRouter, classroomsRouter, closuresRouter, levelsRouter, orgRouter, staffRouter, subjectsRouter } from './routes';

export { getCurrentOrgId } from './current-org';
export { readIntegrationConfig } from './integrations';
export * as orgRepository from './repository';

export const orgRouters = [
  { path: '/api/org', router: orgRouter },
  { path: '/api/branches', router: branchesRouter },
  { path: '/api/classrooms', router: classroomsRouter },
  { path: '/api/closures', router: closuresRouter },
  { path: '/api/levels', router: levelsRouter },
  { path: '/api/subjects', router: subjectsRouter },
  { path: '/api/staff', router: staffRouter },
];