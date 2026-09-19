// backend/src/modules/org/current-org.ts

import { maybeOne, pool } from '../../db';

let cachedOrgId: string | null = null;

export const getCurrentOrgId = async (): Promise<string> => {
  if (cachedOrgId) return cachedOrgId;
  const row = await maybeOne<{ id: string }>(pool,
    'SELECT id FROM organisations WHERE archived_at IS NULL ORDER BY created_at LIMIT 1');
  if (!row) throw new Error('No active organisation exists. Seed or create one first.');
  cachedOrgId = row.id;
  return cachedOrgId;
};