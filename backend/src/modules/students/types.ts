// backend/src/modules/students/types.ts

export interface StudentRow {
  id: string; org_id: string; first_name: string; last_name: string; level_id: string | null;
  date_of_birth: string | null; school: string | null; home_branch_id: string | null; notes: string | null;
  archived_at: Date | null; created_at: Date; updated_at: Date;
}

export interface GuardianView {
  user_id: string; first_name: string; last_name: string; email: string; phone: string | null;
  relationship: 'mother' | 'father' | 'guardian'; is_billing_contact: boolean; receives_notifications: boolean;
}

export interface StudentView extends StudentRow {
  level_code: string | null;
  level_name: string | null;
  home_branch_name: string | null;
  guardians: GuardianView[];
  active_enrollment_count: number;
}

export interface StudentListFilters {
  q?: string;
  levelId?: string;
  branchId?: string;
  includeArchived: boolean;
  limit: number;
  offset: number;
}