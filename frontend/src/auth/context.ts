// frontend/src/auth/context.ts

import { createContext, use } from 'react';
import type { LoginInput, PublicUser, RegisterInput, Role } from '@tuition/shared';

export interface AuthState {
  user: PublicUser | null;
  // true only while the initial refresh is in flight. guards wait for this rather than
  // redirecting to login on a page reload
  isBootstrapping: boolean;
  // true after an explicit sign out, false after sign in. lets the guard distinguish a
  // deliberate sign out, which must not carry a return path to the next person who signs
  // in on this device, from an expired session, which should return the same user to
  // where they were
  signedOut: boolean;
  login: (input: LoginInput) => Promise<PublicUser>;
  register: (input: RegisterInput) => Promise<PublicUser>;
  logout: () => Promise<void>;
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