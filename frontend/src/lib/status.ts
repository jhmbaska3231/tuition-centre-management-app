// frontend/src/lib/status.ts

import type {
  AttendanceStatus, CourseStatus, EnrollmentStatus, InvoiceStatus, LeaveStatus,
  MakeupStatus, PaymentStatus, SessionStatus, WaitlistStatus,
} from '@tuition/shared';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export interface StatusStyle { label: string; tone: StatusTone }

// the union each kind draws from. the same word means different things in different
// places (expired, cancelled, completed, withdrawn, pending, draft), so a status is
// always read together with its kind
export interface StatusKinds {
  session: SessionStatus;
  enrollment: EnrollmentStatus;
  waitlist: WaitlistStatus;
  attendance: AttendanceStatus;
  makeup: MakeupStatus;
  leave: LeaveStatus;
  invoice: InvoiceStatus;
  payment: PaymentStatus;
  course: CourseStatus;
}
export type StatusKind = keyof StatusKinds;

// every value of every status enum. adding a value to a shared enum fails typecheck here
// until it has a label and a tone, so no status can reach the screen unlabelled
const STATUSES: { [K in StatusKind]: Record<StatusKinds[K], StatusStyle> } = {
  session: {
    scheduled: { label: 'Scheduled', tone: 'info' },
    completed: { label: 'Completed', tone: 'neutral' },
    cancelled: { label: 'Cancelled', tone: 'neutral' },
  },
  enrollment: {
    active: { label: 'Enrolled', tone: 'success' },
    withdrawn: { label: 'Withdrawn', tone: 'neutral' },
    completed: { label: 'Completed', tone: 'neutral' },
  },
  waitlist: {
    waiting: { label: 'Waiting', tone: 'info' },
    offered: { label: 'Seat offered', tone: 'warning' },
    accepted: { label: 'Accepted', tone: 'success' },
    expired: { label: 'Offer expired', tone: 'neutral' },
    withdrawn: { label: 'Withdrawn', tone: 'neutral' },
  },
  attendance: {
    present: { label: 'Present', tone: 'success' },
    late: { label: 'Late', tone: 'warning' },
    absent: { label: 'Absent', tone: 'danger' },
    excused: { label: 'Excused', tone: 'info' },
  },
  makeup: {
    available: { label: 'Available', tone: 'success' },
    booked: { label: 'Booked', tone: 'info' },
    used: { label: 'Used', tone: 'neutral' },
    expired: { label: 'Expired', tone: 'neutral' },
    forfeited: { label: 'Forfeited', tone: 'warning' },
  },
  leave: {
    pending: { label: 'Pending', tone: 'warning' },
    approved: { label: 'Approved', tone: 'success' },
    rejected: { label: 'Rejected', tone: 'danger' },
    cancelled: { label: 'Cancelled', tone: 'neutral' },
  },
  invoice: {
    draft: { label: 'Draft', tone: 'neutral' },
    issued: { label: 'Unpaid', tone: 'info' },
    partially_paid: { label: 'Partly paid', tone: 'warning' },
    paid: { label: 'Paid', tone: 'success' },
    void: { label: 'Void', tone: 'neutral' },
  },
  payment: {
    pending: { label: 'Pending', tone: 'warning' },
    succeeded: { label: 'Received', tone: 'success' },
    failed: { label: 'Failed', tone: 'danger' },
    refunded: { label: 'Refunded', tone: 'neutral' },
  },
  course: {
    draft: { label: 'Draft', tone: 'neutral' },
    open: { label: 'Open', tone: 'success' },
    closed: { label: 'Closed', tone: 'neutral' },
    archived: { label: 'Archived', tone: 'neutral' },
  },
};

// overdue is not an invoice status: the api derives it from the due date
export const OVERDUE_STYLE: StatusStyle = { label: 'Overdue', tone: 'danger' };

// callers are type checked against the kind, so the looser lookup here loses nothing.
// an api deployed ahead of this client can send a value added since: show it plainly
// rather than crash the screen
export const statusStyle = (kind: StatusKind, status: string): StatusStyle =>
  (STATUSES[kind] as Record<string, StatusStyle | undefined>)[status] ?? { label: status, tone: 'neutral' };

export const statusLabel = <K extends StatusKind>(kind: K, status: StatusKinds[K]): string =>
  statusStyle(kind, status).label;