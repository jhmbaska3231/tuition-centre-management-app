// shared/src/types/org.ts

import type { AttendanceStatus, IntegrationKind, NotificationEvent } from '../enums';
import type { DateOnly, Timestamp } from './api';

// safe to expose without authentication: name, locale settings and public branding only
export interface PublicOrganisation {
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  // branding, from organisation_settings. null means use the built in defaults
  landing_headline: string | null;
  landing_description: string | null;
  accent_colour: string | null;
  logo_url: string | null;
}

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  archived_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface OrganisationSettings {
  org_id: string;
  session_horizon_weeks: number;
  adhoc_min_lead_minutes: number;
  adhoc_max_lead_days: number;
  travel_buffer_minutes: number;
  attendance_edit_window_days: number;
  waitlist_offer_hours: number;
  makeup_eligible_statuses: AttendanceStatus[];
  makeup_expiry_policy: 'end_of_term' | 'fixed_days';
  makeup_expiry_days: number;
  makeup_min_lead_minutes: number;
  // null means no cap
  makeup_cap_per_term: number | null;
  billing_generation_day: number;
  billing_due_day: number;
  tax_rate_bp: number;
  sibling_discount_bp: number;
  invoice_prefix: string;
  // branding, from organisation_settings. null means use the built in defaults
  landing_headline: string | null;
  landing_description: string | null;
  accent_colour: string | null;
  logo_url: string | null;
  payment_instructions: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface OrganisationResponse {
  organisation: Organisation;
  settings: OrganisationSettings;
}

export interface NotificationEventSetting {
  event_key: NotificationEvent;
  enabled: boolean;
  updated_at: Timestamp;
}

// credentials are never returned decrypted. config_preview masks each value to its
// last four characters so an admin can confirm which key is configured
export interface IntegrationSummary {
  kind: IntegrationKind;
  provider: string;
  is_active: boolean;
  config_preview: Record<string, string>;
  updated_at: Timestamp;
}

export interface Branch {
  id: string;
  org_id: string;
  name: string;
  address: string;
  phone: string | null;
  archived_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Classroom {
  id: string;
  org_id: string;
  branch_id: string;
  name: string;
  capacity: number;
  archived_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Closure {
  id: string;
  org_id: string;
  branch_id: string | null;
  starts_on: DateOnly;
  ends_on: DateOnly;
  reason: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// present only on the create response, reporting how many generated sessions the new
// closure cancelled
export interface ClosureCreated extends Closure {
  sessionsCancelled: number;
}

export interface Level {
  id: string;
  org_id: string;
  code: string;
  name: string;
  sort_order: number;
  archived_at: Timestamp | null;
}

export interface Subject {
  id: string;
  org_id: string;
  name: string;
  archived_at: Timestamp | null;
}

export interface Staff {
  id: string;
  email: string;
  role: 'tutor' | 'branch_manager' | 'admin';
  first_name: string;
  last_name: string;
  phone: string | null;
  last_login_at: Timestamp | null;
  archived_at: Timestamp | null;
  created_at: Timestamp;
  branch_ids: string[];
}

export interface StaffArchived extends Staff {
  futureSessionsNeedingCover: number;
}