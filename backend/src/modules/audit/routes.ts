// backend/src/modules/audit/routes.ts

import { Router } from 'express';
import { auditQuery } from '@tuition/shared';
import { many, pool } from '../../db';
import { validate } from '../../http/middleware/validate';
import { authenticate, authorise, currentUser } from '../auth/middleware';

export const auditRouter = Router();
auditRouter.use(authenticate, authorise('admin'));
auditRouter.get('/', validate({ query: auditQuery }), async (req, res) => {
  const f = req.validated.query;
  res.json(await many(pool,
    `SELECT a.*, CASE WHEN u.id IS NULL THEN NULL ELSE u.first_name || ' ' || u.last_name END AS actor_name
     FROM audit_log a LEFT JOIN users u ON u.id = a.actor_user_id
     WHERE a.org_id = $1 AND ($2::text IS NULL OR a.entity_type = $2) AND ($3::uuid IS NULL OR a.entity_id = $3)
       AND ($4::uuid IS NULL OR a.actor_user_id = $4) AND ($5::text IS NULL OR a.action LIKE $5 || '%')
       AND ($6::date IS NULL OR a.created_at >= $6) AND ($7::date IS NULL OR a.created_at < $7::date + 1)
     ORDER BY a.created_at DESC LIMIT $8 OFFSET $9`,
    [currentUser(req).orgId, f.entityType ?? null, f.entityId ?? null, f.actorUserId ?? null, f.action ?? null, f.from ?? null, f.to ?? null, f.limit, f.offset]));
});