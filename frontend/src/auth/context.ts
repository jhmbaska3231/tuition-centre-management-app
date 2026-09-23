// frontend/src/auth/context.ts

import { createContext, use } from 'react';
import type { LoginInput, PublicUser, RegisterInput, Role } from '@tuition/shared';

// why the user is on the sign in page. signed_out and password_changed are deliberate, so
// no return path is kept for the next person on this device. session_expired keeps it, so
// the same user returns to where they were
export type SignOutReason = 'signed_out' | 'password_changed' | 'session_expired';

// session_expired is only ever set by the provider, when a refresh fails on its own
export type ExplicitSignOutReason = Exclude<SignOutReason, 'session_expired'>;

export interface AuthState {
  user: PublicUser | null;
  // true only while the initial refresh is in flight. guards wait for this rather than
  // redirecting to login on a page reload
  isBootstrapping: boolean;
  // null while signed in, and on a first visit with no session
  signOutReason: SignOutReason | null;
  login: (input: LoginInput) => Promise<PublicUser>;
  register: (input: RegisterInput) => Promise<PublicUser>;
  logout: (options?: { reason?: ExplicitSignOutReason }) => Promise<void>;
  // the profile screen pushes the saved user in so the header updates immediately
  updateCurrentUser: (user: PublicUser) => void;
  hasRole: (...roles: Role[]) => boolean;
}

export const AuthContext = createContext<AuthState | null>(null);

export const useAuth = (): AuthState => {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

// for components that only render behind requireauth, so the user is known to exist
export const useCurrentUser = (): PublicUser => {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser used outside an authenticated route');
  return user;
};