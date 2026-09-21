// shared/src/types/reports.ts

import type { Cents, DateOnly } from './api';

export interface ReportOverview {
  active_students: number;
  active_parents: number;
  open_courses: number;
  active_enrollments: number;
  waitlisted: number;
  active_tutors: number;
  sessions_next_7_days: number;
  outstanding_cents: Cents;
  overdue_cents: Cents;
  pending_leave_requests: number;
}

export interface CourseFillRow {
  id: string;
  name: string;
  branch_name: string;
  subject_name: string;
  level_code: string | null;
  capacity: number;
  enrolled: number;
  waitlisted: number;
  fill_pct: number;
}

export interface EnrollmentBreakdownRow {
  dimension: 'level' | 'subject';
  key: string;
  enrollments: number;
}

export interface RevenueMonthRow {
  month: string;            // YYYY-MM
  invoiced_cents: Cents;
  collected_cents: Cents;
  credited_cents: Cents;
}

export interface AttendanceByCourseRow {
  id: string;
  name: string;
  branch_name: string;
  records: number;
  attended: number;
  absent: number;
  excused: number;
  attendance_pct: number | null;
}

export interface TutorWorkloadRow {
  tutor_id: string;
  tutor_name: string;
  month: string;
  sessions: number;
  hours: number;
  cover_sessions: number;
}

export interface ChurnRow {
  id: string;
  student_name: string;
  last_enrollment_ended: DateOnly;
}