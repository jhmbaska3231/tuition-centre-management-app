// shared/src/types/students.ts

import type { Relationship } from '../enums';
import type { DateOnly, Timestamp } from './api';

export interface Guardian {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  relationship: Relationship;
  is_billing_contact: boolean;
  receives_notifications: boolean;
}

export interface Student {
  id: string;
  org_id: string;
  first_name: string;
  last_name: string;
  level_id: string | null;
  date_of_birth: DateOnly | null;
  school: string | null;
  home_branch_id: string | null;
  notes: string | null;
  archived_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  level_code: string | null;
  level_name: string | null;
  home_branch_name: string | null;
  guardians: Guardian[];
  active_enrollment_count: number;
}