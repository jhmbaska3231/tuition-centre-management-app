// backend/src/modules/enrollment/types.ts

export interface EnrollmentRow {
  id: string; org_id: string; student_id: string; course_id: string; starts_on: string; ends_on: string | null;
  status: 'active' | 'withdrawn' | 'completed'; fee_override_cents: number | null; enrolled_by: string | null;
  withdrawn_at: Date | null; withdraw_reason: string | null; created_at: Date; updated_at: Date;
}

export interface EnrollmentView extends EnrollmentRow {
  student_name: string; course_name: string; branch_name: string; subject_name: string; level_code: string | null;
  fee_billing_cycle: string | null; course_status: string; course_ends_on: string | null; term_ends_on: string | null;
  sessions_held: number; sessions_attended: number; sessions_absent: number;
}

export interface WaitlistRow {
  id: string; org_id: string; student_id: string; course_id: string; status: 'waiting' | 'offered' | 'accepted' | 'expired' | 'withdrawn';
  offered_at: Date | null; offer_expires_at: Date | null; created_at: Date;
}

export interface WaitlistView extends WaitlistRow { student_name: string; course_name: string; position: number }

export interface RosterEntry {
  student_id: string; student_name: string; level_code: string | null; source: 'enrollment' | 'makeup';
  enrollment_id: string | null; makeup_booking_id: string | null;
  attendance_id: string | null; status: 'present' | 'absent' | 'late' | 'excused' | null; notes: string | null; marked_at: Date | null;
}

export interface AttendanceRow {
  id: string; session_id: string; student_id: string; enrollment_id: string | null; makeup_booking_id: string | null;
  status: 'present' | 'absent' | 'late' | 'excused'; notes: string | null; marked_by: string | null; marked_at: Date;
}

export interface MakeupView {
  id: string; student_id: string; student_name: string; credited_from_session_id: string; booked_session_id: string | null;
  status: 'available' | 'booked' | 'used' | 'expired' | 'forfeited'; expires_on: string;
  missed_course_name: string; missed_at: Date; booked_course_name: string | null; booked_at_time: Date | null;
}