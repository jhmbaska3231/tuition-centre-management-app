// backend/src/modules/auth/types.ts

export type Role = 'parent' | 'tutor' | 'branch_manager' | 'admin';

export interface UserRow {
  id: string;
  org_id: string;
  email: string;
  password_hash: string;
  role: Role;
  first_name: string;
  last_name: string;
  phone: string | null;
  last_login_at: Date | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// what req.user looks like after authenticate. no password hash, no timestamps
export interface AuthUser {
  id: string;
  orgId: string;
  role: Role;
  email: string;
  firstName: string;
  lastName: string;
  familyId: string;
  branchIds: string[];
}

export interface AccessTokenClaims {
  sub: string;
  org: string;
  role: Role;
  fam: string;
}

export interface AuthSessionRow {
  id: string;
  user_id: string;
  family_id: string;
  refresh_token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_id: string | null;
  created_at: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: Date;
}

export const toPublicUser = (u: Pick<UserRow, 'id' | 'email' | 'role' | 'first_name' | 'last_name' | 'phone' | 'created_at'>): PublicUser => ({
  id: u.id,
  email: u.email,
  role: u.role,
  firstName: u.first_name,
  lastName: u.last_name,
  phone: u.phone,
  createdAt: u.created_at,
});