// backend/src/modules/billing/invoice-run.ts
//
// daily. for every billable enrollment, work out which periods need a tuition line
// that does not exist yet, pro rate by sessions, group lines by billing contact into
// one invoice each, apply sibling discount and tax, number, issue, notify

import { pool, withTransaction } from '../../db';
import { addDays, todayIn } from '../../lib/time';
import { writeAudit } from '../audit/writer';
import { enqueue } from '../notifications/outbox';
import * as repo from './repository';
import { LineDraft, RunReport } from './types';

const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
const monthEnd = (d: string) => { const [y, m] = d.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const nextMonthStart = (d: string) => { const [y, m] = d.split('-').map(Number); return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); };
const label = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const overlaps = (aStart: string, aEnd: string | null, bStart: string, bEnd: string) => aStart <= bEnd && (aEnd === null || aEnd >= bStart);

// periods this enrollment should be billed for as of today
const periodsDue = (e: repo.BillableEnrollment, today: string, generationDay: number): Array<{ start: string; end: string; name: string }> => {
  const out: Array<{ start: string; end: string; name: string }> = [];
  const clampEnd = (end: string) => (e.course_ends_on && e.course_ends_on < end ? e.course_ends_on : end);
  if (e.billing_cycle === 'monthly') {
    const cur = { start: monthStart(today), end: monthEnd(today) };
    if (overlaps(e.starts_on, e.ends_on, cur.start, cur.end)) out.push({ ...cur, end: clampEnd(cur.end), name: label(cur.start) });
    if (Number(today.slice(8, 10)) >= generationDay) {
      const nxt = { start: nextMonthStart(today), end: monthEnd(nextMonthStart(today)) };
      if (overlaps(e.starts_on, e.ends_on, nxt.start, nxt.end)) out.push({ ...nxt, end: clampEnd(nxt.end), name: label(nxt.start) });
    }
  } else if (e.billing_cycle === 'per_term' && e.term_starts_on && e.term_ends_on) {
    if (e.term_ends_on >= today && overlaps(e.starts_on, e.ends_on, e.term_starts_on, e.term_ends_on)) {
      out.push({ start: e.term_starts_on, end: e.term_ends_on, name: 'term' });
    }
  }
  // per_session is deferred: those enrollments produce no lines from the run
  return out;
};

const dueDate = (periodStart: string, today: string, dueDay: number) => {
  const onDueDay = `${periodStart.slice(0, 7)}-${String(dueDay).padStart(2, '0')}`;
  const minimum = addDays(today, 7);
  return onDueDay > minimum ? onDueDay : minimum;
};

export const runInvoiceGeneration = async (orgId: string): Promise<RunReport> => {
  const ctx = await repo.billingContext(pool, orgId);
  const today = todayIn(ctx.timezone);
  const report: RunReport = { invoicesCreated: 0, linesCreated: 0, skippedNoSessions: 0, errors: [] };

  // 1. build line drafts per billing contact
  const drafts = new Map<string, LineDraft[]>();
  for (const e of await repo.listBillableEnrollments(pool, orgId)) {
    for (const p of periodsDue(e, today, ctx.billing_generation_day)) {
      if (await repo.hasTuitionLine(pool, e.enrollment_id, p.start)) continue;
      const counts = await repo.sessionCounts(pool, e.course_id, p.start, p.end, e.starts_on, e.ends_on);
      if (counts.total === 0 || counts.covered === 0) { report.skippedNoSessions++; continue; }
      const full = e.fee_override_cents ?? e.plan_amount_cents;
      const amount = counts.covered === counts.total ? full : Math.round(full * counts.covered / counts.total);
      const prorated = counts.covered !== counts.total ? ` (${counts.covered} of ${counts.total} sessions)` : '';
      const list = drafts.get(e.bill_to_user_id) ?? [];
      list.push({ studentId: e.student_id, enrollmentId: e.enrollment_id, lineType: 'tuition', description: `${e.course_name}, ${e.student_name}, ${p.name}${prorated}`, unitCents: full, amountCents: amount, periodStart: p.start, periodEnd: p.end });
      drafts.set(e.bill_to_user_id, list);
    }
  }

  // 2. one invoice per contact, each in its own transaction so one failure does not block the rest
  for (const [billTo, lines] of drafts) {
    try {
      await withTransaction(async tx => {
        const subtotal = lines.reduce((s, l) => s + l.amountCents, 0);

        // sibling discount: full price for the most expensive child, discount on the others
        let discount = 0;
        if (ctx.sibling_discount_bp > 0) {
          const byStudent = new Map<string, number>();
          for (const l of lines) byStudent.set(l.studentId, (byStudent.get(l.studentId) ?? 0) + l.amountCents);
          if (byStudent.size > 1) {
            const sorted = [...byStudent.values()].sort((a, b) => b - a);
            discount = Math.round(sorted.slice(1).reduce((s, v) => s + v, 0) * ctx.sibling_discount_bp / 10_000);
          }
        }
        const tax = Math.round((subtotal - discount) * ctx.tax_rate_bp / 10_000);
        const total = subtotal - discount + tax;
        const periodStart = lines.map(l => l.periodStart).sort()[0];
        const periodEnd = lines.map(l => l.periodEnd).sort().reverse()[0];

        const invoice = await repo.insertInvoice(tx, orgId, {
          invoice_number: await repo.nextInvoiceNumber(tx, orgId, ctx.invoice_prefix, today.slice(0, 4)),
          bill_to_user_id: billTo, due_on: dueDate(periodStart, today, ctx.billing_due_day), period_start: periodStart, period_end: periodEnd,
          subtotal_cents: subtotal, discount_cents: discount, tax_cents: tax, total_cents: total, notes: null,
        });
        let order = 0;
        for (const l of lines) {
          await repo.insertLine(tx, { invoice_id: invoice.id, student_id: l.studentId, enrollment_id: l.enrollmentId, line_type: 'tuition', description: l.description, quantity: 1, unit_cents: l.unitCents, amount_cents: l.amountCents, period_start: l.periodStart, period_end: l.periodEnd, sort_order: order++ });
        }
        if (discount > 0) await repo.insertLine(tx, { invoice_id: invoice.id, student_id: null, enrollment_id: null, line_type: 'discount', description: `Sibling discount (${ctx.sibling_discount_bp / 100}%)`, quantity: 1, unit_cents: -discount, amount_cents: -discount, period_start: null, period_end: null, sort_order: order++ });

        await writeAudit(tx, { orgId, actorUserId: null, action: 'invoice.issued', entityType: 'invoice', entityId: invoice.id, after: { invoice_number: invoice.invoice_number, total_cents: total, lines: lines.length } });
        await enqueue(tx, { orgId, recipientUserId: billTo, eventKey: 'invoice_issued', template: 'invoice_issued_v1', payload: { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, totalCents: total, dueOn: invoice.due_on, currency: ctx.currency }, dedupeKey: `invoice_issued:${invoice.id}` });
        report.invoicesCreated++;
        report.linesCreated += lines.length;
      });
    } catch (err) {
      report.errors.push({ billTo, error: (err as Error).message });
    }
  }
  return report;
};

// weekly reminder per overdue invoice, deduped by iso week
export const runOverdueReminders = async (orgId: string): Promise<number> => {
  const ctx = await repo.billingContext(pool, orgId);
  const today = todayIn(ctx.timezone);
  const week = `${today.slice(0, 4)}-W${String(Math.ceil((new Date(today).getTime() - new Date(`${today.slice(0, 4)}-01-01`).getTime()) / 604_800_000)).padStart(2, '0')}`;
  let n = 0;
  for (const inv of await repo.overdueToRemind(pool, orgId)) {
    n += await withTransaction(tx => enqueue(tx, { orgId, recipientUserId: inv.bill_to_user_id, eventKey: 'invoice_overdue', template: 'invoice_overdue_v1', payload: { invoiceId: inv.id, invoiceNumber: inv.invoice_number, dueOn: inv.due_on, balanceCents: inv.total_cents - inv.paid_cents }, dedupeKey: `invoice_overdue:${inv.id}:${week}` }));
  }
  return n;
};