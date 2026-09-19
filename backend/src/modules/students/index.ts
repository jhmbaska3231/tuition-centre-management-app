// backend/src/modules/students/index.ts

export { studentsRouter } from './routes';
export * as studentsRepository from './repository';
export type { StudentView, GuardianView } from './types';