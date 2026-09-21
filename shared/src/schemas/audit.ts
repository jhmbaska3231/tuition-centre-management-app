// shared/src/schemas/audit.ts

import { z } from 'zod';
import { isoDate, uuid } from '../primitives';

export const auditQuery = z.object({
  entityType: z.string().trim().max(50).optional(),
  entityId: uuid.optional(),
  actorUserId: uuid.optional(),
  // matched as a prefix, so 'invoice.' finds every invoice action
  action: z.string().trim().max(80).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});