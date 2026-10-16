// shared/src/types/billing.ts

import type { BillingCycle, BillingFlagKind, BillingFlagStatus, InvoiceLineType, InvoiceStatus, PaymentMethod, PaymentStatus,  } from '../enums';
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
  // live from organisation_settings, not snapshotted. null when the centre has not set it
  payment_instructions: string | null;
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
  overpayments: InvoiceOverpayment[];
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
  invoice_id: string;
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

// a payment settles at most its invoice's balance. anything above is flagged as an overpayment for
// staff to refund, and is reported here so the screen can say so at once
export interface RecordPaymentResponse {
  payment: Payment;
  overpaymentCents: Cents;
}

export interface BalanceSummary {
  outstanding_cents: Cents;
  overdue_cents: Cents;
  // overpayments the centre has not yet refunded: money owed to the parent
  refund_due_cents: Cents;
}

// a payment that needs a person. overpayment: money the centre owes back, raised when a payment
// exceeds its invoice. unpaid_balance: an invoice still owed some days past its due date. the
// amount never changes once raised
export interface BillingFlag {
  id: string;
  invoice_id: string;
  invoice_number: string;
  payment_id: string | null;
  kind: BillingFlagKind;
  amount_cents: Cents;
  status: BillingFlagStatus;
  raised_at: Timestamp;
  resolved_by_name: string | null;
  resolved_at: Timestamp | null;
  resolution_method: PaymentMethod | null;
  resolution_reference: string | null;
  resolution_note: string | null;
  // who the invoice is billed to, so staff can contact them
  bill_to_user_id: string;
  bill_to_name: string;
}

// an overpayment on one invoice, as its parent sees it: how much, and whether it has been refunded
export interface InvoiceOverpayment {
  id: string;
  amount_cents: Cents;
  status: BillingFlagStatus;
  resolved_at: Timestamp | null;
  resolution_method: PaymentMethod | null;
  resolution_reference: string | null;
}