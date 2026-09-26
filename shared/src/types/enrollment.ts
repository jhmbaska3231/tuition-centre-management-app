// shared/src/types/enrollment.ts

import type { AttendanceStatus, BillingCycle, CourseStatus, EnrollmentStatus, MakeupStatus, SessionStatus, WaitlistStatus } from '../enums';
import type { Cents, DateOnly, Timestamp } from './api';

export interface Enrollment {
  id: string;
  org_id: string;
  student_id: string;
  course_id: string;
  starts_on: DateOnly;
  ends_on: DateOnly | null;
  status: EnrollmentStatus;
  fee_override_cents: Cents | null;
  enrolled_by: string | null;
  withdrawn_at: Timestamp | null;
  withdraw_reason: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  student_name: string;
  course_name: string;
  branch_name: string;
  subject_name: string;
  level_code: string | null;
  fee_billing_cycle: BillingCycle | null;
  course_status: CourseStatus;
  course_ends_on: DateOnly | null;
  term_ends_on: DateOnly | null;
  sessions_held: number;
  sessions_attended: number;
  sessions_absent: number;
}

// the single enrollment read. withdraw_effective_on previews the date a withdrawal requested
// now would take effect, computed by the same rule the withdrawal itself applies, so a parent
// sees what they will pay for before confirming. null when there is nothing to withdraw from:
// already withdrawn, or a withdrawal already scheduled
export interface EnrollmentDetail extends Enrollment {
  withdraw_effective_on: DateOnly | null;
}

export interface WaitlistEntry {
  id: string;
  org_id: string;
  student_id: string;
  course_id: string;
  status: WaitlistStatus;
  offered_at: Timestamp | null;
  offer_expires_at: Timestamp | null;
  created_at: Timestamp;
  student_name: string;
  course_name: string;
  position: number;
}

// one row per student the session's roster resolves to. source distinguishes a regular
// enrollment from a student attending on a make up credit
export interface RosterEntry {
  student_id: string;
  student_name: string;
  level_code: string | null;
  source: 'enrollment' | 'makeup';
  enrollment_id: string | null;
  makeup_booking_id: string | null;
  attendance_id: string | null;
  status: AttendanceStatus | null;
  notes: string | null;
  marked_at: Timestamp | null;
}

export interface MarkAttendanceResponse {
  marked: number;
  roster: RosterEntry[];
}

export interface AttendanceHistoryEntry {
  session_id: string;
  starts_at: Timestamp;
  session_status: SessionStatus;
  status: AttendanceStatus | null;
  notes: string | null;
  lesson_notes: string | null;
  homework: string | null;
}

export interface MakeupCredit {
  id: string;
  student_id: string;
  student_name: string;
  credited_from_session_id: string;
  booked_session_id: string | null;
  status: MakeupStatus;
  expires_on: DateOnly;
  missed_course_name: string;
  missed_at: Timestamp;
  booked_course_name: string | null;
  booked_at_time: Timestamp | null;
}

export interface MakeupOption {
  id: string;
  course_id: string;
  course_name: string;
  branch_name: string;
  starts_at: Timestamp;
  ends_at: Timestamp;
  seats_left: number;
}

// the make up rules a parent plans around. eligible_statuses are the attendance marks that earn
// a credit. book_lead_minutes is how far ahead a make up must be booked, and
// cancel_lead_minutes how far ahead it can still be cancelled. cap_per_term is null when there
// is no cap
export interface MakeupPolicy {
  eligible_statuses: AttendanceStatus[];
  book_lead_minutes: number;
  cancel_lead_minutes: number;
  cap_per_term: number | null;
}