// backend/src/modules/billing/repository.ts

import { Queryable, execute, many, maybeOne, one } from '../../db';
import { FeePlanRow, InvoiceLineRow, InvoiceRow, InvoiceView, PaymentRow, PaymentView } from './types';

const set = (fields: Record<string, unknown>, startAt: number) => ({
  sql: Object.keys(fields).map((k, i) => `${k} = $${startAt + i}`).join(', '), params: Object.values(fields),
});

// fee plans -------------------------------------------------------------------------
export const listFeePlans = (q: Queryable, orgId: string) =>
  many<FeePlanRow>(q, 'SELECT * FROM fee_plans WHERE org_id = $1 AND archived_at IS NULL ORDER BY name', [orgId]);
export const findFeePlan = (q: Queryable, orgId: string, id: string) =>
  maybeOne<FeePlanRow>(q, 'SELECT * FROM fee_plans WHERE org_id = $1 AND id = $2', [orgId, id]);
export const insertFeePlan = (q: Queryable, orgId: string, p: { name: string; amount_cents: number; billing_cycle: string }) =>
  one<FeePlanRow>(q, 'INSERT INTO fee_plans (org_id, name, amount_cents, billing_cycle) VALUES ($1, $2, $3, $4) RETURNING *', [orgId, p.name, p.amount_cents, p.billing_cycle]);
export const updateFeePlan = (q: Queryable, orgId: string, id: string, fields: Record<string, unknown>) => {
  const s = set(fields, 3);
  return one<FeePlanRow>(q, `UPDATE fee_plans SET ${s.sql} WHERE org_id = $1 AND id = $2 RETURNING *`, [orgId, id, ...s.params]);
};
export const archiveFeePlan = (q: Queryable, orgId: string, id: string) =>
  one<FeePlanRow>(q, 'UPDATE fee_plans SET archived_at = now() WHERE org_id = $1 AND id = $2 RETURNING *', [orgId, id]);
export const countCoursesOnPlan = async (q: Queryable, planId: string) =>
  (await one<{ n: number }>(q, `SELECT count(*)::int AS n FROM courses WHERE fee_plan_id = $1 AND status IN ('draft', 'open')`, [planId])).n;

// org context -------------------------------------------------------------------------
export const billingContext = (q: Queryable, orgId: string) =>
  one<{ timezone: string; currency: string; billing_generation_day: number; billing_due_day: number; tax_rate_bp: number; sibling_discount_bp: number; invoice_prefix: string }>(q,
    `SELECT o.timezone, o.currency, s.billing_generation_day, s.billing_due_day, s.tax_rate_bp, s.sibling_discount_bp, s.invoice_prefix
     FROM organisations o JOIN organisation_settings s ON s.org_id = o.id WHERE o.id = $1`, [orgId]);

export const nextInvoiceNumber = async (q: Queryable, orgId: string, prefix: string, year: string): Promise<string> => {
  const r = await one<{ n: number }>(q, 'UPDATE invoice_counters SET next_value = next_value + 1 WHERE org_id = $1 RETURNING next_value - 1 AS n', [orgId]);
  return `${prefix}-${year}-${String(r.n).padStart(6, '0')}`;
};

// invoice run inputs -------------------------------------------------------------------------
export interface BillableEnrollment {
  enrollment_id: string; student_id: string; student_name: string; course_id: string; course_name: string;
  starts_on: string; ends_on: string | null; fee_override_cents: number | null;
  plan_amount_cents: number; billing_cycle: string; term_starts_on: string | null; term_ends_on: string | null;
  course_ends_on: string | null; bill_to_user_id: string;
}

// active enrollments with a fee plan and a billing contact. enrollments with no plan are free
export const listBillableEnrollments = (q: Queryable, orgId: string) =>
  many<BillableEnrollment>(q,
    `SELECT e.id AS enrollment_id, e.student_id, st.first_name || ' ' || st.last_name AS student_name, c.id AS course_id, c.name AS course_name,
            e.starts_on, e.ends_on, e.fee_override_cents, fp.amount_cents AS plan_amount_cents, fp.billing_cycle,
            t.starts_on AS term_starts_on, t.ends_on AS term_ends_on, c.ends_on AS course_ends_on, sg.user_id AS bill_to_user_id
     FROM enrollments e
     JOIN students st ON st.id = e.student_id AND st.archived_at IS NULL
     JOIN courses c ON c.id = e.course_id
     JOIN fee_plans fp ON fp.id = c.fee_plan_id
     LEFT JOIN terms t ON t.id = c.term_id
     JOIN student_guardians sg ON sg.student_id = e.student_id AND sg.is_billing_contact
     JOIN users u ON u.id = sg.user_id AND u.archived_at IS NULL
     WHERE e.org_id = $1 AND e.status = 'active'
     ORDER BY sg.user_id, st.first_name, c.name`, [orgId]);

export const hasTuitionLine = async (q: Queryable, enrollmentId: string, periodStart: string) =>
  (await maybeOne(q, `SELECT 1 FROM invoice_lines WHERE enrollment_id = $1 AND period_start = $2 AND line_type = 'tuition' AND voided_at IS NULL`, [enrollmentId, periodStart])) !== null;

// sessions in a period: total for the course, and those the enrollment range covers
export const sessionCounts = (q: Queryable, courseId: string, periodStart: string, periodEnd: string, enrollStart: string, enrollEnd: string | null) =>
  one<{ total: number; covered: number }>(q,
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE d >= $4 AND ($5::date IS NULL OR d <= $5))::int AS covered
     FROM (SELECT (s.starts_at AT TIME ZONE o.timezone)::date AS d FROM sessions s JOIN organisations o ON o.id = s.org_id
           WHERE s.course_id = $1 AND s.status <> 'cancelled') x
     WHERE d BETWEEN $2 AND $3`, [courseId, periodStart, periodEnd, enrollStart, enrollEnd]);

// invoices -------------------------------------------------------------------------
const INVOICE_VIEW = `
  SELECT i.*, u.first_name || ' ' || u.last_name AS bill_to_name, u.email AS bill_to_email,
         (SELECT s.payment_instructions FROM organisation_settings s WHERE s.org_id = i.org_id) AS payment_instructions,
         COALESCE((SELECT sum(cn.amount_cents) FROM credit_notes cn WHERE cn.invoice_id = i.id), 0)::bigint AS credited_cents,
         (i.total_cents - i.paid_cents - COALESCE((SELECT sum(cn.amount_cents) FROM credit_notes cn WHERE cn.invoice_id = i.id), 0))::bigint AS balance_cents,
         (i.status IN ('issued', 'partially_paid') AND i.due_on < current_date) AS is_overdue,
         COALESCE((SELECT json_agg(json_build_object('id', l.id, 'invoice_id', l.invoice_id, 'student_id', l.student_id, 'enrollment_id', l.enrollment_id,
                    'line_type', l.line_type, 'description', l.description, 'quantity', l.quantity, 'unit_cents', l.unit_cents, 'amount_cents', l.amount_cents,
                    'period_start', l.period_start, 'period_end', l.period_end, 'sort_order', l.sort_order, 'voided_at', l.voided_at,
                    'student_name', CASE WHEN st.id IS NULL THEN NULL ELSE st.first_name || ' ' || st.last_name END) ORDER BY l.sort_order)
                   FROM invoice_lines l LEFT JOIN students st ON st.id = l.student_id WHERE l.invoice_id = i.id), '[]'::json) AS lines,
         COALESCE((SELECT json_agg(json_build_object('payment_id', p.id, 'amount_cents', pa.amount_cents, 'method', p.method, 'received_at', p.received_at, 'reference', p.reference) ORDER BY p.received_at)
                   FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE pa.invoice_id = i.id), '[]'::json) AS allocations,
         COALESCE((SELECT json_agg(json_build_object('id', cn.id, 'amount_cents', cn.amount_cents, 'reason', cn.reason, 'created_at', cn.created_at) ORDER BY cn.created_at)
                   FROM credit_notes cn WHERE cn.invoice_id = i.id), '[]'::json) AS credit_notes
  FROM invoices i JOIN users u ON u.id = i.bill_to_user_id`;

export const findInvoiceView = (q: Queryable, orgId: string, id: string) =>
  maybeOne<InvoiceView>(q, `${INVOICE_VIEW} WHERE i.org_id = $1 AND i.id = $2`, [orgId, id]);
export const findInvoiceForUpdate = (q: Queryable, orgId: string, id: string) =>
  maybeOne<InvoiceRow>(q, 'SELECT * FROM invoices WHERE org_id = $1 AND id = $2 FOR UPDATE', [orgId, id]);

export interface InvoiceFilters { billToUserId?: string; studentId?: string; status?: string; overdue?: boolean; from?: string; to?: string; limit: number; offset: number }
export const listInvoices = (q: Queryable, orgId: string, f: InvoiceFilters) =>
  many<InvoiceView>(q,
    `${INVOICE_VIEW}
     WHERE i.org_id = $1 AND ($2::uuid IS NULL OR i.bill_to_user_id = $2)
       AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM invoice_lines l WHERE l.invoice_id = i.id AND l.student_id = $3))
       AND ($4::text IS NULL OR i.status = $4)
       AND (NOT $5::boolean OR (i.status IN ('issued', 'partially_paid') AND i.due_on < current_date))
       AND ($6::date IS NULL OR i.issued_at >= $6) AND ($7::date IS NULL OR i.issued_at < $7::date + 1)
     ORDER BY i.issued_at DESC NULLS LAST, i.created_at DESC LIMIT $8 OFFSET $9`,
    [orgId, f.billToUserId ?? null, f.studentId ?? null, f.status ?? null, f.overdue ?? false, f.from ?? null, f.to ?? null, f.limit, f.offset]);

export const insertInvoice = (q: Queryable, orgId: string, i: { invoice_number: string; bill_to_user_id: string; due_on: string; period_start: string | null; period_end: string | null; subtotal_cents: number; discount_cents: number; tax_cents: number; total_cents: number; notes: string | null }) =>
  one<InvoiceRow>(q,
    `INSERT INTO invoices (org_id, invoice_number, bill_to_user_id, status, issued_at, due_on, period_start, period_end, subtotal_cents, discount_cents, tax_cents, total_cents, notes)
     VALUES ($1, $2, $3, 'issued', now(), $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [orgId, i.invoice_number, i.bill_to_user_id, i.due_on, i.period_start, i.period_end, i.subtotal_cents, i.discount_cents, i.tax_cents, i.total_cents, i.notes]);

export const insertLine = (q: Queryable, l: { invoice_id: string; student_id: string | null; enrollment_id: string | null; line_type: string; description: string; quantity: number; unit_cents: number; amount_cents: number; period_start: string | null; period_end: string | null; sort_order: number }) =>
  one<InvoiceLineRow>(q,
    `INSERT INTO invoice_lines (invoice_id, student_id, enrollment_id, line_type, description, quantity, unit_cents, amount_cents, period_start, period_end, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [l.invoice_id, l.student_id, l.enrollment_id, l.line_type, l.description, l.quantity, l.unit_cents, l.amount_cents, l.period_start, l.period_end, l.sort_order]);

// recompute the cached paid_cents and status from allocations and credit notes
export const refreshInvoiceStatus = (q: Queryable, invoiceId: string) =>
  one<InvoiceRow>(q,
    `UPDATE invoices i SET paid_cents = x.paid,
       status = CASE WHEN i.status = 'void' THEN 'void'
                     WHEN x.paid + x.credited >= i.total_cents THEN 'paid'
                     WHEN x.paid + x.credited > 0 THEN 'partially_paid'
                     ELSE 'issued' END
     FROM (SELECT COALESCE((SELECT sum(amount_cents) FROM payment_allocations WHERE invoice_id = $1), 0)::bigint AS paid,
                  COALESCE((SELECT sum(amount_cents) FROM credit_notes WHERE invoice_id = $1), 0)::bigint AS credited) x
     WHERE i.id = $1 RETURNING i.*`, [invoiceId]);

export const voidInvoice = async (q: Queryable, id: string, reason: string) => {
  await execute(q, `UPDATE invoice_lines SET voided_at = now() WHERE invoice_id = $1`, [id]);
  return one<InvoiceRow>(q, `UPDATE invoices SET status = 'void', voided_at = now(), void_reason = $2 WHERE id = $1 RETURNING *`, [id, reason]);
};

export const insertCreditNote = (q: Queryable, orgId: string, c: { invoice_id: string; amount_cents: number; reason: string; issued_by: string }) =>
  one<{ id: string }>(q, 'INSERT INTO credit_notes (org_id, invoice_id, amount_cents, reason, issued_by) VALUES ($1, $2, $3, $4, $5) RETURNING id', [orgId, c.invoice_id, c.amount_cents, c.reason, c.issued_by]);

export const openInvoicesForPayer = (q: Queryable, orgId: string, payerId: string) =>
  many<InvoiceRow & { balance_cents: number }>(q,
    `SELECT i.*, (i.total_cents - i.paid_cents - COALESCE((SELECT sum(amount_cents) FROM credit_notes WHERE invoice_id = i.id), 0))::bigint AS balance_cents
     FROM invoices i WHERE i.org_id = $1 AND i.bill_to_user_id = $2 AND i.status IN ('issued', 'partially_paid') ORDER BY i.due_on, i.issued_at FOR UPDATE`, [orgId, payerId]);

export const overdueToRemind = (q: Queryable, orgId: string) =>
  many<InvoiceRow>(q, `SELECT * FROM invoices WHERE org_id = $1 AND status IN ('issued', 'partially_paid') AND due_on < current_date`, [orgId]);

export const findUser = (q: Queryable, orgId: string, id: string) =>
  maybeOne<{ id: string; role: string; archived_at: Date | null }>(q, 'SELECT id, role, archived_at FROM users WHERE org_id = $1 AND id = $2', [orgId, id]);

// payments -------------------------------------------------------------------------
const PAYMENT_VIEW = `
  SELECT p.*, CASE WHEN u.id IS NULL THEN NULL ELSE u.first_name || ' ' || u.last_name END AS payer_name,
         COALESCE((SELECT sum(amount_cents) FROM payment_allocations WHERE payment_id = p.id), 0)::bigint AS allocated_cents,
         COALESCE((SELECT json_agg(json_build_object('invoice_id', i.id, 'invoice_number', i.invoice_number, 'amount_cents', pa.amount_cents))
                   FROM payment_allocations pa JOIN invoices i ON i.id = pa.invoice_id WHERE pa.payment_id = p.id), '[]'::json) AS allocations
  FROM payments p LEFT JOIN users u ON u.id = p.payer_user_id`;

export const findPaymentView = (q: Queryable, orgId: string, id: string) =>
  maybeOne<PaymentView>(q, `${PAYMENT_VIEW} WHERE p.org_id = $1 AND p.id = $2`, [orgId, id]);
export const findPaymentForUpdate = (q: Queryable, orgId: string, id: string) =>
  maybeOne<PaymentRow>(q, 'SELECT * FROM payments WHERE org_id = $1 AND id = $2 FOR UPDATE', [orgId, id]);
export const listPayments = (q: Queryable, orgId: string, f: { payerUserId?: string; from?: string; to?: string; limit: number; offset: number }) =>
  many<PaymentView>(q,
    `${PAYMENT_VIEW} WHERE p.org_id = $1 AND ($2::uuid IS NULL OR p.payer_user_id = $2)
       AND ($3::date IS NULL OR p.received_at >= $3) AND ($4::date IS NULL OR p.received_at < $4::date + 1)
     ORDER BY p.received_at DESC LIMIT $5 OFFSET $6`, [orgId, f.payerUserId ?? null, f.from ?? null, f.to ?? null, f.limit, f.offset]);
export const insertPayment = (q: Queryable, orgId: string, p: { payer_user_id: string | null; amount_cents: number; method: string; status: string; received_at: Date; reference: string | null; provider: string | null; provider_payload: unknown; recorded_by: string | null; notes: string | null }) =>
  one<PaymentRow>(q,
    `INSERT INTO payments (org_id, payer_user_id, amount_cents, method, status, received_at, reference, provider, provider_payload, recorded_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [orgId, p.payer_user_id, p.amount_cents, p.method, p.status, p.received_at, p.reference, p.provider, p.provider_payload === undefined ? null : JSON.stringify(p.provider_payload), p.recorded_by, p.notes]);
export const insertAllocation = (q: Queryable, paymentId: string, invoiceId: string, amount: number) =>
  execute(q, 'INSERT INTO payment_allocations (payment_id, invoice_id, amount_cents) VALUES ($1, $2, $3)', [paymentId, invoiceId, amount]);
export const deleteAllocations = (q: Queryable, paymentId: string) =>
  many<{ invoice_id: string }>(q, 'DELETE FROM payment_allocations WHERE payment_id = $1 RETURNING invoice_id', [paymentId]);
export const setPaymentStatus = (q: Queryable, id: string, status: string, note: string | null) =>
  one<PaymentRow>(q, `UPDATE payments SET status = $2, notes = COALESCE($3, notes) WHERE id = $1 RETURNING *`, [id, status, note]);

export const balanceSummary = (q: Queryable, orgId: string, userId: string) =>
  one<{ outstanding_cents: number; overdue_cents: number; unallocated_cents: number }>(q,
    `SELECT COALESCE((SELECT sum(i.total_cents - i.paid_cents - COALESCE((SELECT sum(amount_cents) FROM credit_notes WHERE invoice_id = i.id), 0))
                       FROM invoices i WHERE i.org_id = $1 AND i.bill_to_user_id = $2 AND i.status IN ('issued', 'partially_paid')), 0)::bigint AS outstanding_cents,
            COALESCE((SELECT sum(i.total_cents - i.paid_cents - COALESCE((SELECT sum(amount_cents) FROM credit_notes WHERE invoice_id = i.id), 0))
                       FROM invoices i WHERE i.org_id = $1 AND i.bill_to_user_id = $2 AND i.status IN ('issued', 'partially_paid') AND i.due_on < current_date), 0)::bigint AS overdue_cents,
            COALESCE((SELECT sum(p.amount_cents - COALESCE((SELECT sum(amount_cents) FROM payment_allocations WHERE payment_id = p.id), 0))
                       FROM payments p WHERE p.org_id = $1 AND p.payer_user_id = $2 AND p.status = 'succeeded'), 0)::bigint AS unallocated_cents`, [orgId, userId]);

// webhooks -------------------------------------------------------------------------
export const insertWebhookEvent = (q: Queryable, orgId: string, provider: string, eventId: string, payload: unknown) =>
  maybeOne<{ id: string }>(q,
    `INSERT INTO webhook_events (org_id, provider, provider_event_id, payload) VALUES ($1, $2, $3, $4) ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id`,
    [orgId, provider, eventId, JSON.stringify(payload)]);
export const markWebhookProcessed = (q: Queryable, id: string, error: string | null) =>
  execute(q, 'UPDATE webhook_events SET processed_at = now(), error = $2 WHERE id = $1', [id, error]);