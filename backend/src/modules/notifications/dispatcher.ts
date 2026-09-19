// backend/src/modules/notifications/dispatcher.ts

import { pool, withTransaction } from '../../db';
import { emailProviderFor } from './providers/email';
import * as repo from './repository';
import { hasTemplate, render } from './templates';
import { ClaimedNotification } from './types';

const BATCH = 50;
const LEASE_SECONDS = 120;
const MAX_ATTEMPTS = 5;
const backoffSeconds = (attempt: number) => Math.min(3600, 60 * 2 ** (attempt - 1));  // 1m, 2m, 4m, 8m, 16m

const deliver = async (n: ClaimedNotification): Promise<void> => {
  if (n.recipient_archived_at) { await repo.markCancelled(pool, n.id, 'recipient archived'); return; }
  if (n.pref_enabled === false) { await repo.markCancelled(pool, n.id, 'recipient opted out'); return; }
  if (n.channel !== 'email') { await repo.markCancelled(pool, n.id, `channel ${n.channel} not implemented`); return; }
  if (!hasTemplate(n.template)) { await repo.markFailed(pool, n.id, `unknown template ${n.template}`); return; }

  try {
    const provider = await emailProviderFor(n.org_id);
    const email = render(n.template, n.payload, { firstName: n.recipient_first_name, orgName: n.org_name, timezone: n.org_timezone, currency: n.org_currency });
    await provider.send({ to: n.recipient_email, toName: `${n.recipient_first_name} ${n.recipient_last_name}`, ...email });
    await repo.markSent(pool, n.id);
  } catch (err) {
    const message = (err as Error).message.slice(0, 500);
    if (n.attempts >= MAX_ATTEMPTS) await repo.markFailed(pool, n.id, message);
    else await repo.markRetry(pool, n.id, message, backoffSeconds(n.attempts));
  }
};

// drains the queue in batches, returns counts for the job log
export const dispatchPending = async (): Promise<{ sent: number; retried: number; failed: number; cancelled: number }> => {
  const totals = { sent: 0, retried: 0, failed: 0, cancelled: 0 };
  for (;;) {
    const batch = await withTransaction(tx => repo.claimBatch(tx, BATCH, LEASE_SECONDS));
    if (batch.length === 0) break;
    for (const n of batch) {
      await deliver(n);
    }
    // recount from the rows' final states for accurate totals
    const ids = batch.map(b => b.id);
    const rows = await pool.query<{ status: string; n: number }>(`SELECT status, count(*)::int AS n FROM notifications WHERE id = ANY($1) GROUP BY status`, [ids]);
    for (const r of rows.rows) {
      if (r.status === 'sent') totals.sent += r.n;
      else if (r.status === 'pending') totals.retried += r.n;
      else if (r.status === 'failed') totals.failed += r.n;
      else if (r.status === 'cancelled') totals.cancelled += r.n;
    }
    if (batch.length < BATCH) break;
  }
  return totals;
};