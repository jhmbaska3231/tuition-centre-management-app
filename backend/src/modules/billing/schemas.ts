// backend/src/modules/billing/schemas.ts

import { z } from 'zod';
import { isoDate, uuid } from '../../http/middleware/validate';

const cents = z.number().int().min(0).max(100_000_000);

export const createFeePlanSchema = z.object({ name: z.string().trim().min(1).max(100), amount_cents: cents, billing_cycle: z.enum(['monthly', 'per_term', 'per_session']) });
export const updateFeePlanSchema = createFeePlanSchema.partial().refine(o => Object.keys(o).length > 0, 'No fields to update');

export const listInvoicesQuery = z.object({
  billToUserId: uuid.optional(), studentId: uuid.optional(),
  status: z.enum(['draft', 'issued', 'partially_paid', 'paid', 'void']).optional(),
  overdue: z.stringbool().optional(), from: isoDate.optional(), to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50), offset: z.coerce.number().int().min(0).default(0),
});

// manual one off invoice (registration fee, materials, adjustment)
export const createManualInvoiceSchema = z.object({
  billToUserId: uuid,
  dueOn: isoDate,
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(z.object({
    studentId: uuid.nullable().default(null),
    lineType: z.enum(['registration', 'material', 'adjustment', 'discount']),
    description: z.string().trim().min(1).max(200),
    quantity: z.number().positive().max(1000).default(1),
    unitCents: z.number().int().min(-100_000_000).max(100_000_000),
  })).min(1).max(50),
});

export const voidInvoiceSchema = z.object({ reason: z.string().trim().min(1).max(500) });
export const creditNoteSchema = z.object({ amountCents: z.number().int().min(1), reason: z.string().trim().min(1).max(500) });

export const recordPaymentSchema = z.object({
  payerUserId: uuid,
  amountCents: z.number().int().min(1),
  method: z.enum(['cash', 'paynow', 'bank_transfer', 'card', 'cheque']),
  receivedAt: z.iso.datetime({ offset: true }).optional(),
  reference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
  // omit to auto allocate to the payer's oldest open invoices
  allocations: z.array(z.object({ invoiceId: uuid, amountCents: z.number().int().min(1) })).optional(),
});
export const listPaymentsQuery = z.object({
  payerUserId: uuid.optional(), from: isoDate.optional(), to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50), offset: z.coerce.number().int().min(0).default(0),
});
export const refundSchema = z.object({ reason: z.string().trim().min(1).max(500) });
export const providerParam = z.object({ provider: z.string().regex(/^[a-z_]{2,30}$/) });