// backend/src/modules/org/integrations.ts
//
// decrypted read of a provider integration. lives outside org/service.ts so that
// modules which need it (notifications, billing) do not import the org service and
// create a circular dependency. never expose the result over http

import { pool } from '../../db';
import { decrypt } from '../../lib/crypto';
import { findIntegration } from './repository';

export interface IntegrationConfig {
  provider: string;
  config: Record<string, string>;
}

export const readIntegrationConfig = async (orgId: string, kind: 'email' | 'sms' | 'whatsapp' | 'payment'): Promise<IntegrationConfig | null> => {
  const row = await findIntegration(pool, orgId, kind);
  if (!row || !row.is_active) return null;
  return { provider: row.provider, config: JSON.parse(decrypt(row.config_encrypted)) as Record<string, string> };
};