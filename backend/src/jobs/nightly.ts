// backend/src/jobs/nightly.ts

import { closePool, pool } from '../db';
import { runInvoiceGeneration, runOverdueReminders } from '../modules/billing';
import { runLifecycleJob } from '../modules/enrollment';
import { getCurrentOrgId } from '../modules/org';
import { generateForAllOpenCourses, schedulingRepository } from '../modules/scheduling';

export const runNightly = async () => {
  const orgId = await getCurrentOrgId();
  const completed = await schedulingRepository.completePastSessions(pool);
  const generation = await generateForAllOpenCourses(orgId);
  const lifecycle = await runLifecycleJob(orgId);
  const invoices = await runInvoiceGeneration(orgId);
  const overdue = await runOverdueReminders(orgId);
  const summary = {
    sessionsCompleted: completed,
    sessionsCreated: generation.reduce((n, r) => n + r.created, 0),
    generationConflicts: generation.flatMap(r => r.skippedConflict.map(c => ({ courseId: r.courseId, ...c }))),
    lifecycle, invoices, overdueReminders: overdue,
  };
  console.log(JSON.stringify({ level: 'info', msg: 'nightly_job', ...summary }));
  return summary;
};

if (require.main === module) {
  runNightly().then(closePool).catch(err => { console.error(err); process.exit(1); });
}