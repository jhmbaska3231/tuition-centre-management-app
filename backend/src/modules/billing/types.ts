// backend/src/modules/billing/types.ts

export interface FeePlanRow { id: string; org_id: string; name: string; amount_cents: number; billing_cycle: 'monthly' | 'per_term' | 'per_session'; archived_at: Date | null }

export interface InvoiceRow {
  id: string; org_id: string; invoice_number: string; bill_to_user_id: string;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void';
  issued_at: Date | null; due_on: string | null; period_start: string | null; period_end: string | null;
  subtotal_cents: number; discount_cents: number; tax_cents: number; total_cents: number; paid_cents: number;
  voided_at: Date | null; void_reason: string | null; notes: string | null; created_at: Date;
}

export interface InvoiceLineRow {
  id: string; invoice_id: string; student_id: string | null; enrollment_id: string | null;
  line_type: 'tuition' | 'registration' | 'material' | 'discount' | 'adjustment';
  description: string; quantity: number; unit_cents: number; amount_cents: number;
  period_start: string | null; period_end: string | null; sort_order: number; voided_at: Date | null;
}

export interface InvoiceView extends InvoiceRow {
  bill_to_name: string; bill_to_email: string; credited_cents: number; balance_cents: number; is_overdue: boolean;
  lines: Array<InvoiceLineRow & { student_name: string | null }>;
  allocations: Array<{ payment_id: string; amount_cents: number; method: string; received_at: Date; reference: string | null }>;
  credit_notes: Array<{ id: string; amount_cents: number; reason: string; created_at: Date }>;
}

export interface PaymentRow {
  id: string; org_id: string; payer_user_id: string | null; amount_cents: number; method: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'; received_at: Date; reference: string | null;
  provider: string | null; recorded_by: string | null; notes: string | null; created_at: Date;
}

export interface PaymentView extends PaymentRow { payer_name: string | null; allocated_cents: number; allocations: Array<{ invoice_id: string; invoice_number: string; amount_cents: number }> }

export interface LineDraft {
  studentId: string; enrollmentId: string; lineType: 'tuition'; description: string;
  unitCents: number; amountCents: number; periodStart: string; periodEnd: string;
}

export interface RunReport { invoicesCreated: number; linesCreated: number; skippedNoSessions: number; errors: Array<{ billTo: string; error: string }> }