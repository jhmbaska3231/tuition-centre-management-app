// shared/src/types/auth.ts

import type { Role } from '../enums';
import type { Timestamp } from './api';

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  first_name: string;
  last_name: string;
  phone: string | null;
  created_at: Timestamp;
}

export interface SessionResponse {
  accessToken: string;
  user: PublicUser;
}

export interface MeResponse {
  user: PublicUser;
}