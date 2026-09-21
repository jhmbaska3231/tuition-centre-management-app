// shared/src/types/users.ts

import type { Cents, Timestamp } from './api';
import type { Relationship } from '../enums';
import type { PublicUser } from './auth';

export interface ParentStudentSummary {
  id: string;
  first_name: string;
  last_name: string;
  level_code: string | null;
  relationship: Relationship;
  is_billing_contact: boolean;
}

export interface Parent {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  last_login_at: Timestamp | null;
  archived_at: Timestamp | null;
  created_at: Timestamp;
  students: ParentStudentSummary[];
  outstanding_cents: Cents;
}

export interface ProfileResponse {
  user: PublicUser;
}

export interface DeleteAccountResponse {
  studentsArchived: number;
}