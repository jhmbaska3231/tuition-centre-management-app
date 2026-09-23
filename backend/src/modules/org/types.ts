// backend/src/modules/org/types.ts

export interface OrganisationRow {
  id: string; name: string; slug: string; timezone: string; currency: string;
  archived_at: Date | null; created_at: Date; updated_at: Date;
}

export interface OrganisationSettingsRow {
  org_id: string;
  session_horizon_weeks: number; adhoc_min_lead_minutes: number; adhoc_max_lead_days: number;
  travel_buffer_minutes: number; attendance_edit_window_days: number; waitlist_offer_hours: number;
  makeup_eligible_statuses: string[]; makeup_expiry_policy: 'end_of_term' | 'fixed_days'; makeup_expiry_days: number;
  makeup_min_lead_minutes: number; makeup_cap_per_term: number | null;
  billing_generation_day: number; billing_due_day: number; tax_rate_bp: number; sibling_discount_bp: number;
  invoice_prefix: string; payment_instructions: string | null; updated_at: Date;
}

export interface NotificationEventSettingRow { event_key: string; enabled: boolean; updated_at: Date }

export interface IntegrationRow {
  id: string; org_id: string; kind: 'email' | 'sms' | 'whatsapp' | 'payment'; provider: string;
  config_encrypted: Buffer; is_active: boolean; updated_by: string | null; created_at: Date; updated_at: Date;
}

export interface BranchRow {
  id: string; org_id: string; name: string; address: string; phone: string | null;
  archived_at: Date | null; created_at: Date; updated_at: Date;
}

export interface ClassroomRow {
  id: string; org_id: string; branch_id: string; name: string; capacity: number;
  archived_at: Date | null; created_at: Date; updated_at: Date;
}

export interface ClosureRow {
  id: string; org_id: string; branch_id: string | null; starts_on: string; ends_on: string; reason: string;
  created_at: Date; updated_at: Date;
}

export interface LevelRow {
  id: string; org_id: string; code: string; name: string; sort_order: number; archived_at: Date | null;
}

export interface SubjectRow { id: string; org_id: string; name: string; archived_at: Date | null }

export interface StaffRow {
  id: string; email: string; role: 'tutor' | 'branch_manager' | 'admin'; first_name: string; last_name: string;
  phone: string | null; last_login_at: Date | null; archived_at: Date | null; created_at: Date; branch_ids: string[];
}