// backend/src/modules/audit/index.ts

export { writeAudit } from './writer';
export type { AuditEntry } from './writer';
export { auditRouter } from './routes';