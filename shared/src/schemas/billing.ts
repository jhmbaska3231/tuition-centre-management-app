// shared/src/schemas/billing.ts

import { z } from 'zod';
import { BILLING_CYCLES, INVOICE_STATUSES, PAYMENT_METHODS, BILLING_FLAG_KINDS, BILLING_FLAG_STATUSES } from '../enums';
import { cents, isoDate, isoDateTime, signedCents, uuid } from '../primitives';

const feePlanFields = z.object({
  name: z.string().trim().min(1).max(100),
  amount_cents: cents,
  billing_cycle: z.enum(BILLING_CYCLES),
});
export const createFeePlanSchema = feePlanFields;
export const updateFeePlanSchema = feePlanFields.partial().refine(o => Object.keys(o).length > 0, 'No fields to update');
export type CreateFeePlanInput = z.infer<typeof createFeePlanSchema>;
export type UpdateFeePlanInput = z.infer<typeof updateFeePlanSchema>;

export const listInvoicesQuery = z.object({
  billToUserId: uuid.optional(),
  studentId: uuid.optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  overdue: z.stringbool().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// a one off invoice: registration fee, materials, an adjustment. tuition lines are
// only ever created by the invoice run
export const createManualInvoiceSchema = z.object({
  billToUserId: uuid,
  dueOn: isoDate,
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(z.object({
    studentId: uuid.nullable().default(null),
    lineType: z.enum(['registration', 'material', 'adjustment', 'discount']),
    description: z.string().trim().min(1).max(200),
    quantity: z.number().positive().max(1000).default(1),
    unitCents: signedCents,
  })).min(1).max(50),
});
export type CreateManualInvoiceInput = z.infer<typeof createManualInvoiceSchema>;

export const voidInvoiceSchema = z.object({ reason: z.string().trim().min(1).max(500) });
export const creditNoteSchema = z.object({
  amountCents: z.number().int().min(1),
  reason: z.string().trim().min(1).max(500),
});
export type CreditNoteInput = z.infer<typeof creditNoteSchema>;

// one payment settles one invoice. anything above its balance is flagged as an overpayment
export const recordPaymentSchema = z.object({
  invoiceId: uuid,
  amountCents: cents,
  method: z.enum(PAYMENT_METHODS),
  receivedAt: isoDateTime.optional(),
  reference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

// method and reference are required to resolve an overpayment, which the service checks
// against the flag's kind. a note alone can resolve an unpaid balance
export const resolveBillingFlagSchema = z.object({
  method: z.enum(PAYMENT_METHODS).optional(),
  reference: z.string().trim().min(1).max(100).optional(),
  note: z.string().trim().max(1000).optional(),
});

export const listPaymentsQuery = z.object({
  payerUserId: uuid.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// a refund returns money, so how and with what reference are recorded, as they are for a payment
export const refundSchema = z.object({
  reason: z.string().trim().min(1).max(500),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().min(1).max(100),
});
export const providerParam = z.object({ provider: z.string().regex(/^[a-z_]{2,30}$/) });

export const listBillingFlagsQuery = z.object({
  status: z.enum(BILLING_FLAG_STATUSES).optional(),
  kind: z.enum(BILLING_FLAG_KINDS).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});