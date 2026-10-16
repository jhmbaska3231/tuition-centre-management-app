// backend/src/modules/billing/service.ts

import type { PoolClient } from 'pg';
import type { RecordPaymentInput } from '@tuition/shared';
import { pool, withTransaction } from '../../db';
import { ForbiddenError, NotFoundError, RuleViolationError, ValidationError } from '../../http/errors';
import { todayIn } from '../../lib/time';
import { writeAudit } from '../audit/writer';
import { AuthUser } from '../auth/types';
import { enqueue, enqueueForRole } from '../notifications/outbox';
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
    if (before.paid_cents > 0) throw new RuleViolationError('Refund the payments on this invoice before voiding it');
    await closeUnpaidFlagIfSettled(tx, await repo.voidInvoice(tx, id, reason));
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
    await closeUnpaidFlagIfSettled(tx, await repo.refreshInvoiceStatus(tx, invoiceId));
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'credit_note.issued', entityType: 'credit_note', entityId: cn.id, after: { invoiceId, amountCents, reason } });
    return (await repo.findInvoiceView(tx, user.orgId, invoiceId))!;
  });

// payments ---------------------------------------------------------------------------
interface ApplyPaymentInput {
  invoiceId: string;
  amountCents: number;
  method: string;
  receivedAt: Date;
  reference: string | null;
  provider: string | null;
  providerPayload: unknown;
  recordedBy: string | null;
  notes: string | null;
}

// an unpaid balance flag closes itself once the invoice no longer asks for money, whether a
// payment settled it, a credit note cleared it, or it was voided
const closeUnpaidFlagIfSettled = async (tx: PoolClient, invoice: { id: string; status: string }) => {
  if (invoice.status === 'paid') await repo.resolveOpenUnpaidFlag(tx, invoice.id, 'Settled: nothing left to pay');
  else if (invoice.status === 'void') await repo.resolveOpenUnpaidFlag(tx, invoice.id, 'Invoice voided');
};

// the one path by which money arrives, whether staff record it or a gateway reports it. a payment
// settles at most its invoice's balance. anything above that is an overpayment, flagged for a
// person to refund, never kept as credit. the payer is the invoice's, so a payment cannot be
// recorded against one family for another's invoice
const applyPayment = async (tx: PoolClient, orgId: string, input: ApplyPaymentInput) => {
  const invoice = await repo.findInvoiceForUpdate(tx, orgId, input.invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');
  if (invoice.status === 'draft' || invoice.status === 'void') {
    throw new RuleViolationError(`A payment cannot be recorded against a ${invoice.status} invoice`);
  }
  const view = (await repo.findInvoiceView(tx, orgId, invoice.id))!;

  const payment = await repo.insertPayment(tx, orgId, {
    payer_user_id: invoice.bill_to_user_id, invoice_id: invoice.id, amount_cents: input.amountCents,
    method: input.method, status: 'succeeded', received_at: input.receivedAt, reference: input.reference,
    provider: input.provider, provider_payload: input.providerPayload, recorded_by: input.recordedBy, notes: input.notes,
  });

  // a paid invoice has no balance, so a payment against it is entirely an overpayment
  const applied = Math.min(input.amountCents, Math.max(0, view.balance_cents));
  if (applied > 0) {
    await repo.insertAllocation(tx, payment.id, invoice.id, applied);
    await closeUnpaidFlagIfSettled(tx, await repo.refreshInvoiceStatus(tx, invoice.id));
  }

  const overpaid = input.amountCents - applied;
  if (overpaid > 0) {
    const flag = await repo.insertBillingFlag(tx, {
      org_id: orgId, invoice_id: invoice.id, payment_id: payment.id, kind: 'overpayment', amount_cents: overpaid,
    });
    // branch managers take payments from any family that walks in, so every one of them is told,
    // as well as the admins
    await enqueueForRole(tx, orgId, ['admin', 'branch_manager'], 'billing_flag_raised', 'billing_flag_raised_v1',
      { flagId: flag.id, kind: flag.kind, invoiceNumber: view.invoice_number, parentName: view.bill_to_name, amountCents: flag.amount_cents },
      `billing_flag:${flag.id}`);
  }
  return { payment, overpaid };
};

export const recordPayment = (user: AuthUser, input: RecordPaymentInput) =>
  withTransaction(async tx => {
    assertStaff(user);
    const { payment, overpaid } = await applyPayment(tx, user.orgId, {
      invoiceId: input.invoiceId, amountCents: input.amountCents, method: input.method,
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(), reference: input.reference ?? null,
      provider: null, providerPayload: undefined, recordedBy: user.id, notes: input.notes ?? null,
    });
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'payment.recorded', entityType: 'payment', entityId: payment.id, after: { ...payment, overpaidCents: overpaid } });
    return { payment: (await repo.findPaymentView(tx, user.orgId, payment.id))!, overpaymentCents: overpaid };
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

// a payment reported by a gateway, idempotent on (provider, reference). a card charge is fixed to
// the balance at checkout, but the balance can change before the provider reports it, if staff
// record a payment meanwhile. the same rule then flags the excess
export const applyGatewayPayment = async (orgId: string, p: { provider: string; reference: string; invoiceId: string; amountCents: number; method: string; payload: unknown }) =>
  withTransaction(async tx => {
    const { payment, overpaid } = await applyPayment(tx, orgId, {
      invoiceId: p.invoiceId, amountCents: p.amountCents, method: p.method, receivedAt: new Date(), reference: p.reference,
      provider: p.provider, providerPayload: p.payload, recordedBy: null, notes: null,
    });
    await writeAudit(tx, { orgId, actorUserId: null, action: 'payment.gateway', entityType: 'payment', entityId: payment.id, after: { provider: p.provider, reference: p.reference, overpaidCents: overpaid } });
    return payment;
  });

// returns a whole payment, made in error or bounced. its invoice reopens. the money leaves the
// centre, so how it was returned is recorded as precisely as how it arrived. any overpayment on the
// payment goes back with it, so that flag is resolved here with the same evidence
export const refundPayment = (user: AuthUser, id: string, input: { reason: string; method: string; reference: string }) =>
  withTransaction(async tx => {
    assertStaff(user);
    const before = await repo.findPaymentForUpdate(tx, user.orgId, id);
    if (!before || before.status !== 'succeeded') throw new NotFoundError('Succeeded payment');
    const flag = await repo.findOverpaymentFlagForUpdate(tx, id);
    // the excess has already been returned on its own, so refunding the whole payment would return
    // that money a second time
    if (flag?.status === 'resolved') {
      throw new RuleViolationError('The overpayment on this payment was already refunded, so the whole payment cannot be');
    }
    const touched = await repo.deleteAllocations(tx, id);
    for (const t of touched) await repo.refreshInvoiceStatus(tx, t.invoice_id);
    if (flag) {
      await repo.resolveBillingFlag(tx, flag.id, { by: user.id, method: input.method, reference: input.reference, note: `Returned with the whole payment: ${input.reason}` });
    }
    const after = await repo.setPaymentStatus(tx, id, 'refunded', `Refunded: ${input.reason}`);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'payment.refunded', entityType: 'payment', entityId: id, before, after: { ...input, invoicesReopened: touched.length, overpaymentResolved: flag !== null } });
    return (await repo.findPaymentView(tx, user.orgId, id))!;
  });

// billing flags ---------------------------------------------------------------------------
// raised by the nightly job: invoices still owed more than the grace period past their due date
export const raiseUnpaidBalanceFlags = (orgId: string) =>
  withTransaction(async tx => {
    const ctx = await repo.billingContext(tx, orgId);
    const raised = await repo.raiseUnpaidBalanceFlags(tx, orgId, ctx.unpaid_flag_days, todayIn(ctx.timezone));
    for (const flag of raised) {
      await enqueueForRole(tx, orgId, ['admin', 'branch_manager'], 'billing_flag_raised', 'billing_flag_raised_v1',
        { flagId: flag.id, kind: 'unpaid_balance', invoiceNumber: flag.invoice_number, parentName: flag.bill_to_name, amountCents: flag.amount_cents, dueOn: flag.due_on },
        `billing_flag:${flag.id}`);
      await writeAudit(tx, { orgId, actorUserId: null, action: 'billing_flag.raised', entityType: 'billing_flag', entityId: flag.id, after: flag });
    }
    return raised.length;
  });

export const listBillingFlags = (user: AuthUser, f: { status?: string; kind?: string; limit: number; offset: number }) => {
  assertStaff(user);
  return repo.listBillingFlags(pool, user.orgId, f);
};

// staff resolve a flag on the record. an overpayment needs how the money went back and the transfer
// reference, so it matches the bank statement. an unpaid balance resolved by hand needs a note
// saying why, since the money may still be owed: a payment plan agreed, say
export const resolveBillingFlag = (user: AuthUser, id: string, input: { method?: string; reference?: string; note?: string }) =>
  withTransaction(async tx => {
    assertStaff(user);
    const flag = await repo.findBillingFlagForUpdate(tx, user.orgId, id);
    if (!flag) throw new NotFoundError('Payment alert');
    if (flag.status === 'resolved') throw new RuleViolationError('This payment alert is already resolved');

    const issues: Array<{ path: string; message: string }> = [];
    if (flag.kind === 'overpayment') {
      if (!input.method) issues.push({ path: 'body.method', message: 'Choose how the money was returned' });
      if (!input.reference) issues.push({ path: 'body.reference', message: 'Enter the transfer reference' });
    } else if (!input.note) {
      issues.push({ path: 'body.note', message: 'Say why this is resolved' });
    }
    if (issues.length > 0) throw new ValidationError('Invalid request', issues);

    await repo.resolveBillingFlag(tx, id, { by: user.id, method: input.method ?? null, reference: input.reference ?? null, note: input.note ?? null });
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'billing_flag.resolved', entityType: 'billing_flag', entityId: id, before: flag, after: input });
    return (await repo.findBillingFlagView(tx, user.orgId, id))!;
  });