// shared/src/types/scheduling.ts

import type { CourseStatus, LeaveStatus, LeaveType, SessionStatus } from '../enums';
import type { BillingCycle } from '../enums';
import type { Cents, DateOnly, TimeOnly, Timestamp } from './api';

export interface Term {
  id: string;
  org_id: string;
  name: string;
  starts_on: DateOnly;
  ends_on: DateOnly;
  archived_at: Timestamp | null;
}

export interface CourseSlot {
  id: string;
  course_id: string;
  weekday: number;
  start_time: TimeOnly;
  duration_minutes: number;
}

export interface Course {
  id: string;
  org_id: string;
  branch_id: string;
  subject_id: string;
  level_id: string | null;
  term_id: string | null;
  fee_plan_id: string | null;
  name: string;
  description: string | null;
  default_tutor_id: string | null;
  default_classroom_id: string | null;
  capacity: number;
  starts_on: DateOnly;
  ends_on: DateOnly | null;
  status: CourseStatus;
  created_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  branch_name: string;
  subject_name: string;
  level_code: string | null;
  level_name: string | null;
  term_name: string | null;
  tutor_name: string | null;
  classroom_name: string | null;
  fee_plan_name: string | null;
  fee_amount_cents: Cents | null;
  fee_billing_cycle: BillingCycle | null;
  slots: CourseSlot[];
  active_enrollment_count: number;
  // seats a new family can take: free seats after the waitlist's claim. use this, not
  // capacity minus active_enrollment_count, which ignores the queue and future starts
  seats_left: number;
  waitlist_count: number;
}

export interface Session {
  id: string;
  org_id: string;
  course_id: string;
  slot_id: string | null;
  starts_at: Timestamp;
  ends_at: Timestamp;
  tutor_id: string | null;
  classroom_id: string | null;
  status: SessionStatus;
  cancel_reason: string | null;
  cover_for_leave_id: string | null;
  lesson_notes: string | null;
  homework: string | null;
  is_adhoc: boolean;
  created_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  course_name: string;
  branch_id: string;
  branch_name: string;
  level_code: string | null;
  subject_name: string;
  tutor_name: string | null;
  classroom_name: string | null;
  roster_count: number;
  // derived: no tutor, tutor archived, or tutor on approved leave for this date
  needs_cover: boolean;
  // the requesting parent's children who attend this session, by active enrollment or a
  // booked make up. absent for staff and for the single session read, which do not compute it
  viewer_student_ids?: string[];
}

// reported by the session generator. skippedconflict entries are slots the exclusion
// constraints refused, they are surfaced rather than thrown so one clash does not
// abort the rest of the run
export interface GenerationReport {
  courseId: string;
  created: number;
  skippedClosure: number;
  skippedConflict: Array<{ startsAt: Timestamp; reason: string }>;
}

export interface CourseMutationResponse {
  course: Course;
  generation: GenerationReport | null;
}

// warnings are soft rules (tutor availability, travel buffer between branches). they
// never block the write, the ui shows them next to the result
export interface SessionMutationResponse {
  session: Session;
  warnings: string[];
}

export interface SessionCancelResponse {
  session: Session;
  guardiansNotified: number;
  makeupsReleased: number;
}

export interface TutorAvailability {
  id: string;
  user_id: string;
  weekday: number;
  start_time: TimeOnly;
  end_time: TimeOnly;
}

export interface LeaveRequest {
  id: string;
  org_id: string;
  user_id: string;
  starts_on: DateOnly;
  ends_on: DateOnly;
  leave_type: LeaveType;
  status: LeaveStatus;
  reason: string | null;
  decided_by: string | null;
  decided_at: Timestamp | null;
  decision_note: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  requester_name: string;
  requester_role: string;
  decided_by_name: string | null;
  affected_session_count: number;
}