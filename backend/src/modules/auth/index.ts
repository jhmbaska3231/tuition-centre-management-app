// backend/src/modules/auth/index.ts

export { authRouter } from './routes';
export { authenticate, authorise, canAccessBranch, currentUser } from './middleware';
export type { AuthUser, Role } from './types';