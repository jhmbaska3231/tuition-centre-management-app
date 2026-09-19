// backend/src/modules/audit/writer.ts

import { Queryable, execute } from '../../db';

export interface AuditEntry {
  orgId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

export const writeAudit = (q: Queryable, a: AuditEntry) =>
  execute(q,
    `INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, before, after, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [a.orgId, a.actorUserId, a.action, a.entityType, a.entityId,
      a.before === undefined ? null : JSON.stringify(a.before),
      a.after === undefined ? null : JSON.stringify(a.after),
      a.ip ?? null]);