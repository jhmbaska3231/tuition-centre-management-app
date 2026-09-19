// backend/src/modules/billing/service.ts

import { pool, withTransaction, Queryable } from '../../db';
import { ForbiddenError, NotFoundError, RuleViolationError } from '../../http/errors';
import { todayIn } from '../../lib/time';
import { writeAudit } from '../audit/writer';
import { AuthUser } from '../auth/types';
import { enqueue } from '../notifications/outbox';
import * as repo from './repository';

const STAFF = new Set(['admin', 'branch_manager']);
const assertStaff = (user: AuthUser) => { if (!STAFF.has(user.role)) throw new ForbiddenError(); };

// fee plans ---------------------------------------------------------------------------
export const listFeePlans = (user: AuthUser) => { if (user.role === 'parent') throw new ForbiddenError(); return repo.listFeePlans(pool, user.orgId); };
export const createFeePlan = (user: AuthUser, input: { name: string; amount_cents: number; billing_cycle: string }) =>
  withTransaction(async tx => {
    if (user.role !== 'admin') throw new ForbiddenError();
    const row = await repo.insertFeePlan(tx, user.orgId, input);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'fee_plan.created', entityType: 'fee_plan', entityId: row.id, after: row });
    return row;
  });
export const updateFeePlan = (user: AuthUser, id: string, fields: Record<string, unknown>) =>
  withTransaction(async tx => {
    if (user.role !== 'admin') throw new ForbiddenError();
    const before = await repo.findFeePlan(tx, user.orgId, id);
    if (!before || before.archived_at) throw new NotFoundError('Fee plan');
    // amount changes only affect lines generated from now on, issued invoices are snapshots
    const after = await repo.updateFeePlan(tx, user.orgId, id, fields);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'fee_plan.updated', entityType: 'fee_plan', entityId: id, before, after });
    return after;
  });
export const archiveFeePlan = (user: AuthUser, id: string) =>
  withTransaction(async tx => {
    if (user.role !== 'admin') throw new ForbiddenError();
    const before = await repo.findFeePlan(tx, user.orgId, id);
    if (!before || before.archived_at) throw new NotFoundError('Fee plan');
    const n = await repo.countCoursesOnPlan(tx, id);
    if (n > 0) throw new RuleViolationError(`${n} open course(s) use this fee plan`);
    const after = await repo.archiveFeePlan(tx, user.orgId, id);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'fee_plan.archived', entityType: 'fee_plan', entityId: id, before });
    return after;
  });

// invoices ---------------------------------------------------------------------------
export const listInvoices = (user: AuthUser, f: repo.InvoiceFilters) => {
  if (user.role === 'parent') return repo.listInvoices(pool, user.orgId, { ...f, billToUserId: user.id });
  assertStaff(user);
  return repo.listInvoices(pool, user.orgId, f);
};

export const getInvoice = async (user: AuthUser, id: string) => {
  const inv = await repo.findInvoiceView(pool, user.orgId, id);
  if (!inv) throw new NotFoundError('Invoice');
  if (user.role === 'parent' && inv.bill_to_user_id !== user.id) throw new NotFoundError('Invoice');
  if (user.role === 'tutor') throw new ForbiddenError();
  return inv;
};

export const myBalance = (user: AuthUser) => repo.balanceSummary(pool, user.orgId, user.id);

export const createManualInvoice = (user: AuthUser, input: { billToUserId: string; dueOn: string; notes?: string; lines: Array<{ studentId: string | null; lineType: string; description: string; quantity: number; unitCents: number }> }) =>
  withTransaction(async tx => {
    assertStaff(user);
    const payer = await repo.findUser(tx, user.orgId, input.billToUserId);
    if (!payer || payer.archived_at || payer.role !== 'parent') throw new RuleViolationError('Bill-to must be an active parent');
    const ctx = await repo.billingContext(tx, user.orgId);
    const today = todayIn(ctx.timezone);
    if (input.dueOn < today) throw new RuleViolationError('Due date cannot be in the past');
    const amounts = input.lines.map(l => Math.round(l.quantity * l.unitCents));
    const subtotal = amounts.filter(a => a > 0).reduce((s, a) => s + a, 0);
    const discount = -amounts.filter(a => a < 0).reduce((s, a) => s + a, 0);
    if (subtotal - discount <= 0) throw new RuleViolationError('Invoice total must be positive');
    const tax = Math.round((subtotal - discount) * ctx.tax_rate_bp / 10_000);
    const invoice = await repo.insertInvoice(tx, user.orgId, {
      invoice_number: await repo.nextInvoiceNumber(tx, user.orgId, ctx.invoice_prefix, today.slice(0, 4)),
      bill_to_user_id: input.billToUserId, due_on: input.dueOn, period_start: null, period_end: null,
      subtotal_cents: subtotal, discount_cents: discount, tax_cents: tax, total_cents: subtotal - discount + tax, notes: input.notes ?? null,
    });
    for (let i = 0; i < input.lines.length; i++) {
      const l = input.lines[i];
      await repo.insertLine(tx, { invoice_id: invoice.id, student_id: l.studentId, enrollment_id: null, line_type: l.lineType, description: l.description, quantity: l.quantity, unit_cents: l.unitCents, amount_cents: amounts[i], period_start: null, period_end: null, sort_order: i });
    }
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'invoice.issued_manual', entityType: 'invoice', entityId: invoice.id, after: invoice });
    await enqueue(tx, { orgId: user.orgId, recipientUserId: input.billToUserId, eventKey: 'invoice_issued', template: 'invoice_issued_v1', payload: { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, totalCents: invoice.total_cents, dueOn: invoice.due_on, currency: ctx.currency }, dedupeKey: `invoice_issued:${invoice.id}` });
    return (await repo.findInvoiceView(tx, user.orgId, invoice.id))!;
  });

export const voidInvoice = (user: AuthUser, id: string, reason: string) =>
  withTransaction(async tx => {
    assertStaff(user);
    const before = await repo.findInvoiceForUpdate(tx, user.orgId, id);
    if (!before || before.status === 'void') throw new NotFoundError('Invoice');
    if (before.paid_cents > 0) throw new RuleViolationError('Refund or reallocate payments before voiding');
    await repo.voidInvoice(tx, id, reason);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'invoice.voided', entityType: 'invoice', entityId: id, before, after: { reason } });
    return (await repo.findInvoiceView(tx, user.orgId, id))!;
  });

export const issueCreditNote = (user: AuthUser, invoiceId: string, amountCents: number, reason: string) =>
  withTransaction(async tx => {
    assertStaff(user);
    const inv = await repo.findInvoiceForUpdate(tx, user.orgId, invoiceId);
    if (!inv || inv.status === 'void') throw new NotFoundError('Invoice');
    const view = (await repo.findInvoiceView(tx, user.orgId, invoiceId))!;
    if (amountCents > view.balance_cents) throw new RuleViolationError(`Credit cannot exceed the outstanding balance (${view.balance_cents})`);
    const cn = await repo.insertCreditNote(tx, user.orgId, { invoice_id: invoiceId, amount_cents: amountCents, reason, issued_by: user.id });
    await repo.refreshInvoiceStatus(tx, invoiceId);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'credit_note.issued', entityType: 'credit_note', entityId: cn.id, after: { invoiceId, amountCents, reason } });
    return (await repo.findInvoiceView(tx, user.orgId, invoiceId))!;
  });

// payments ---------------------------------------------------------------------------
// allocates within the caller's transaction. explicit allocations are validated, otherwise
// oldest open invoices first. returns any unallocated remainder (kept as credit)
const allocate = async (tx: Queryable, orgId: string, paymentId: string, payerId: string, amount: number, explicit?: Array<{ invoiceId: string; amountCents: number }>): Promise<number> => {
  const open = await repo.openInvoicesForPayer(tx, orgId, payerId);
  let remaining = amount;
  if (explicit) {
    const requested = explicit.reduce((s, a) => s + a.amountCents, 0);
    if (requested > amount) throw new RuleViolationError('Allocations exceed the payment amount');
    for (const a of explicit) {
      const inv = open.find(i => i.id === a.invoiceId);
      if (!inv) throw new RuleViolationError('Invoice is not open or does not belong to this payer');
      if (a.amountCents > inv.balance_cents) throw new RuleViolationError(`Allocation exceeds balance of ${inv.invoice_number}`);
      await repo.insertAllocation(tx, paymentId, inv.id, a.amountCents);
      await repo.refreshInvoiceStatus(tx, inv.id);
      remaining -= a.amountCents;
    }
  } else {
    for (const inv of open) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, inv.balance_cents);
      if (take <= 0) continue;
      await repo.insertAllocation(tx, paymentId, inv.id, take);
      await repo.refreshInvoiceStatus(tx, inv.id);
      remaining -= take;
    }
  }
  return remaining;
};

export const recordPayment = (user: AuthUser, input: { payerUserId: string; amountCents: number; method: string; receivedAt?: string; reference?: string; notes?: string; allocations?: Array<{ invoiceId: string; amountCents: number }> }) =>
  withTransaction(async tx => {
    assertStaff(user);
    const payer = await repo.findUser(tx, user.orgId, input.payerUserId);
    if (!payer || payer.role !== 'parent') throw new RuleViolationError('Payer must be a parent account');
    const payment = await repo.insertPayment(tx, user.orgId, {
      payer_user_id: payer.id, amount_cents: input.amountCents, method: input.method, status: 'succeeded',
      received_at: input.receivedAt ? new Date(input.receivedAt) : new Date(), reference: input.reference ?? null,
      provider: null, provider_payload: undefined, recorded_by: user.id, notes: input.notes ?? null,
    });
    const unallocated = await allocate(tx, user.orgId, payment.id, payer.id, input.amountCents, input.allocations);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'payment.recorded', entityType: 'payment', entityId: payment.id, after: { ...payment, unallocated } });
    return { payment: (await repo.findPaymentView(tx, user.orgId, payment.id))!, unallocatedCents: unallocated };
  });

export const listPayments = (user: AuthUser, f: { payerUserId?: string; from?: string; to?: string; limit: number; offset: number }) => {
  if (user.role === 'parent') return repo.listPayments(pool, user.orgId, { ...f, payerUserId: user.id });
  assertStaff(user);
  return repo.listPayments(pool, user.orgId, f);
};

export const getPayment = async (user: AuthUser, id: string) => {
  const p = await repo.findPaymentView(pool, user.orgId, id);
  if (!p) throw new NotFoundError('Payment');
  if (user.role === 'parent' && p.payer_user_id !== user.id) throw new NotFoundError('Payment');
  if (user.role === 'tutor') throw new ForbiddenError();
  return p;
};

// refund reverses the allocations, the invoices become outstanding again
export const refundPayment = (user: AuthUser, id: string, reason: string) =>
  withTransaction(async tx => {
    assertStaff(user);
    const before = await repo.findPaymentForUpdate(tx, user.orgId, id);
    if (!before || before.status !== 'succeeded') throw new NotFoundError('Succeeded payment');
    const touched = await repo.deleteAllocations(tx, id);
    for (const t of touched) await repo.refreshInvoiceStatus(tx, t.invoice_id);
    const after = await repo.setPaymentStatus(tx, id, 'refunded', `Refunded: ${reason}`);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'payment.refunded', entityType: 'payment', entityId: id, before, after: { reason, invoicesReopened: touched.length } });
    return (await repo.findPaymentView(tx, user.orgId, id))!;
  });

// applies a payment that arrived through a gateway, idempotent on (provider, reference)
export const applyGatewayPayment = async (orgId: string, p: { provider: string; reference: string; payerUserId: string; amountCents: number; method: string; invoiceId: string | null; payload: unknown }) =>
  withTransaction(async tx => {
    const payment = await repo.insertPayment(tx, orgId, {
      payer_user_id: p.payerUserId, amount_cents: p.amountCents, method: p.method, status: 'succeeded', received_at: new Date(),
      reference: p.reference, provider: p.provider, provider_payload: p.payload, recorded_by: null, notes: null,
    });
    const explicit = p.invoiceId ? [{ invoiceId: p.invoiceId, amountCents: p.amountCents }] : undefined;
    let unallocated: number;
    try { unallocated = await allocate(tx, orgId, payment.id, p.payerUserId, p.amountCents, explicit); }
    catch { unallocated = await allocate(tx, orgId, payment.id, p.payerUserId, p.amountCents); }  // invoice changed since checkout: fall back to oldest first
    await writeAudit(tx, { orgId, actorUserId: null, action: 'payment.gateway', entityType: 'payment', entityId: payment.id, after: { provider: p.provider, reference: p.reference, unallocated } });
    return payment;
  });