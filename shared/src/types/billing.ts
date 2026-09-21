// shared/src/types/billing.ts

import type { BillingCycle, InvoiceLineType, InvoiceStatus, PaymentMethod, PaymentStatus } from '../enums';
import type { Cents, DateOnly, Timestamp } from './api';

export interface FeePlan {
  id: string;
  org_id: string;
  name: string;
  amount_cents: Cents;
  billing_cycle: BillingCycle;
  archived_at: Timestamp | null;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  student_id: string | null;
  enrollment_id: string | null;
  line_type: InvoiceLineType;
  description: string;
  quantity: number;
  unit_cents: Cents;
  amount_cents: Cents;
  period_start: DateOnly | null;
  period_end: DateOnly | null;
  sort_order: number;
  voided_at: Timestamp | null;
  student_name: string | null;
}

export interface InvoiceAllocation {
  payment_id: string;
  amount_cents: Cents;
  method: PaymentMethod;
  received_at: Timestamp;
  reference: string | null;
}

export interface CreditNote {
  id: string;
  amount_cents: Cents;
  reason: string;
  created_at: Timestamp;
}

export interface Invoice {
  id: string;
  org_id: string;
  invoice_number: string;
  bill_to_user_id: string;
  status: InvoiceStatus;
  issued_at: Timestamp | null;
  due_on: DateOnly | null;
  period_start: DateOnly | null;
  period_end: DateOnly | null;
  subtotal_cents: Cents;
  discount_cents: Cents;
  tax_cents: Cents;
  total_cents: Cents;
  paid_cents: Cents;
  voided_at: Timestamp | null;
  void_reason: string | null;
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  bill_to_name: string;
  bill_to_email: string;
  credited_cents: Cents;
  // total - paid - credited
  balance_cents: Cents;
  // derived: open and past due_on, never stored
  is_overdue: boolean;
  lines: InvoiceLine[];
  allocations: InvoiceAllocation[];
  credit_notes: CreditNote[];
}

export interface PaymentAllocationSummary {
  invoice_id: string;
  invoice_number: string;
  amount_cents: Cents;
}

export interface Payment {
  id: string;
  org_id: string;
  payer_user_id: string | null;
  amount_cents: Cents;
  method: PaymentMethod;
  status: PaymentStatus;
  received_at: Timestamp;
  reference: string | null;
  provider: string | null;
  recorded_by: string | null;
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  payer_name: string | null;
  allocated_cents: Cents;
  allocations: PaymentAllocationSummary[];
}

// any remainder not allocated to an invoice stays on the payment as credit
export interface RecordPaymentResponse {
  payment: Payment;
  unallocatedCents: Cents;
}

export interface BalanceSummary {
  outstanding_cents: Cents;
  overdue_cents: Cents;
  unallocated_cents: Cents;
}