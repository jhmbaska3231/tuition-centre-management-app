// shared/src/types/audit.ts

import type { Timestamp } from './api';

export interface AuditEntry {
  id: string;
  org_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  created_at: Timestamp;
  actor_name: string | null;
}