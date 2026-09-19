// backend/src/modules/users/index.ts

import { accountRouter, parentsRouter } from './routes';

export const usersRouters = [
  { path: '/api/account', router: accountRouter },
  { path: '/api/parents', router: parentsRouter },
];