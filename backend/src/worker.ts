// backend/src/worker.ts
//
// background worker: schedules and runs jobs via pg-boss, start with node dist/worker.js

import { PgBoss } from 'pg-boss';
import { config } from './config';
import { closePool } from './db';
import { dispatchPending } from './modules/notifications/dispatcher';
import { enqueueSessionReminders } from './modules/notifications/reminders';
import { getCurrentOrgId } from './modules/org/current-org';
import { runNightly } from './jobs/nightly';

const QUEUES = { nightly: 'nightly', reminders: 'session-reminders', dispatch: 'dispatch-notifications' } as const;

const main = async () => {
  const boss = new PgBoss({
    host: config.db.host, port: config.db.port, database: config.db.database, user: config.db.user, password: config.db.password,
    ssl: config.db.ssl, max: 5, schema: 'pgboss',
  });
  boss.on('error', (err: Error) => console.error(JSON.stringify({ level: 'error', msg: 'pgboss_error', error: err.message })));
  await boss.start();

  for (const q of Object.values(QUEUES)) await boss.createQueue(q);

  const orgId = await getCurrentOrgId();
  const tz = 'Asia/Singapore';

  // cron schedules are stored in the database, re registering is idempotent
  await boss.schedule(QUEUES.nightly, '30 2 * * *', null, { tz });  // 02:30 local
  await boss.schedule(QUEUES.reminders, '5 * * * *', null, { tz });  // hourly
  await boss.schedule(QUEUES.dispatch, '* * * * *', null, { tz });  // every minute

  await boss.work(QUEUES.nightly, { pollingIntervalSeconds: 30 }, async () => { await runNightly(); });
  await boss.work(QUEUES.reminders, { pollingIntervalSeconds: 30 }, async () => {
    const n = await enqueueSessionReminders(orgId);
    console.log(JSON.stringify({ level: 'info', msg: 'reminders_job', enqueued: n }));
  });
  await boss.work(QUEUES.dispatch, { pollingIntervalSeconds: 5 }, async () => {
    const t = await dispatchPending();
    if (t.sent + t.retried + t.failed + t.cancelled > 0) console.log(JSON.stringify({ level: 'info', msg: 'dispatch_job', ...t }));
  });

  console.log(JSON.stringify({ level: 'info', msg: 'worker_started', queues: Object.values(QUEUES) }));

  const shutdown = async (signal: string) => {
    console.log(JSON.stringify({ level: 'info', msg: 'worker_shutdown', signal }));
    await boss.stop({ graceful: true, timeout: 10_000 });
    await closePool();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

main().catch(err => { console.error(err); process.exit(1); });