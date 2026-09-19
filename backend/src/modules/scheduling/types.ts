// backend/src/modules/scheduling/types.ts

export interface TermRow { id: string; org_id: string; name: string; starts_on: string; ends_on: string; archived_at: Date | null }

export interface SlotRow { id: string; course_id: string; weekday: number; start_time: string; duration_minutes: number }

export interface CourseRow {
  id: string; org_id: string; branch_id: string; subject_id: string; level_id: string | null; term_id: string | null;
  fee_plan_id: string | null; name: string; description: string | null; default_tutor_id: string | null;
  default_classroom_id: string | null; capacity: number; starts_on: string; ends_on: string | null;
  status: 'draft' | 'open' | 'closed' | 'archived'; created_by: string | null; created_at: Date; updated_at: Date;
}

export interface CourseView extends CourseRow {
  branch_name: string; subject_name: string; level_code: string | null; level_name: string | null;
  term_name: string | null; tutor_name: string | null; classroom_name: string | null;
  fee_plan_name: string | null; fee_amount_cents: number | null; fee_billing_cycle: string | null;
  slots: SlotRow[]; active_enrollment_count: number; waitlist_count: number;
}

export interface SessionRow {
  id: string; org_id: string; course_id: string; slot_id: string | null; starts_at: Date; ends_at: Date;
  tutor_id: string | null; classroom_id: string | null; status: 'scheduled' | 'cancelled' | 'completed';
  cancel_reason: string | null; cover_for_leave_id: string | null; lesson_notes: string | null; homework: string | null;
  is_adhoc: boolean; created_by: string | null; created_at: Date; updated_at: Date;
}

export interface SessionView extends SessionRow {
  course_name: string; branch_id: string; branch_name: string; level_code: string | null; subject_name: string;
  tutor_name: string | null; classroom_name: string | null; roster_count: number; needs_cover: boolean;
}

export interface LeaveRow {
  id: string; org_id: string; user_id: string; starts_on: string; ends_on: string; leave_type: 'annual' | 'medical' | 'other';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'; reason: string | null; decided_by: string | null;
  decided_at: Date | null; decision_note: string | null; created_at: Date;
}

export interface LeaveView extends LeaveRow { requester_name: string; requester_role: string; decided_by_name: string | null; affected_session_count: number }

export interface AvailabilityRow { id: string; user_id: string; weekday: number; start_time: string; end_time: string }

export interface GenerationReport { courseId: string; created: number; skippedClosure: number; skippedConflict: Array<{ startsAt: string; reason: string }> }