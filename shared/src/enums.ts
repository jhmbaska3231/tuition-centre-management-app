// shared/src/enums.ts
//
// values that appear in database check constraints. the arrays are the single source
// of truth, the zod enums and typescript unions are derived from them, so adding a
// value means editing one line plus the migration

export const ROLES = ['parent', 'tutor', 'branch_manager', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const RELATIONSHIPS = ['mother', 'father', 'guardian'] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const COURSE_STATUSES = ['draft', 'open', 'closed', 'archived'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const SESSION_STATUSES = ['scheduled', 'cancelled', 'completed'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const ENROLLMENT_STATUSES = ['active', 'withdrawn', 'completed'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const WAITLIST_STATUSES = ['waiting', 'offered', 'accepted', 'expired', 'withdrawn'] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const MAKEUP_STATUSES = ['available', 'booked', 'used', 'expired', 'forfeited'] as const;
export type MakeupStatus = (typeof MAKEUP_STATUSES)[number];

export const LEAVE_TYPES = ['annual', 'medical', 'other'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const BILLING_CYCLES = ['monthly', 'per_term', 'per_session'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_LINE_TYPES = ['tuition', 'registration', 'material', 'discount', 'adjustment'] as const;
export type InvoiceLineType = (typeof INVOICE_LINE_TYPES)[number];

export const PAYMENT_METHODS = ['cash', 'paynow', 'bank_transfer', 'card', 'cheque'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['pending', 'succeeded', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const NOTIFICATION_CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// toggleable by the admin. account_created and password_reset are transactional and
// always send, so they are deliberately absent
export const NOTIFICATION_EVENTS = [
  'session_reminder', 'session_cancelled', 'session_rescheduled', 'tutor_changed',
  'student_absent', 'invoice_issued', 'invoice_overdue', 'waitlist_offer',
  'leave_request_submitted', 'leave_request_decided',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const INTEGRATION_KINDS = ['email', 'sms', 'whatsapp', 'payment'] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];