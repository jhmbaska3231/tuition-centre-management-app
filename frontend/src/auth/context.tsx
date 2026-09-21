// frontend/src/auth/context.tsx

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LoginInput, PublicUser, RegisterInput, Role, SessionResponse } from '@tuition/shared';
import { api, bootstrapSession } from '@/api/client';
import { clearQueryCache } from '@/api/query-client';
import { setAccessToken, subscribeToToken } from '@/api/token-store';

interface AuthState {
  user: PublicUser | null;
  // true only while the initial refresh is in flight. guards must wait for this rather
  // than redirecting to login on a page reload
  isBootstrapping: boolean;
  login: (input: LoginInput) => Promise<PublicUser>;
  register: (input: RegisterInput) => Promise<PublicUser>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const bootstrapped = useRef(false);

  // exchange the refresh cookie for an access token on first load. strictmode mounts
  // twice in development, and a second refresh would present a token the first call has
  // already rotated, which the backend correctly treats as re use and would revoke the
  // whole family. the ref makes this run once
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    let cancelled = false;
    bootstrapSession()
      .then(session => {
        if (!cancelled && session) setUser(session.user);
      })
      .finally(() => {
        if (!cancelled) setIsBootstrapping(false);
      });

    return () => { cancelled = true; };
  }, []);

  // a refresh failing mid session clears the token. mirror that into the user so the
  // guards redirect rather than rendering a shell with no data
  useEffect(() => subscribeToToken(token => {
    if (token === null) {
      setUser(null);
      clearQueryCache();
    }
  }), []);

  const login = useCallback(async (input: LoginInput) => {
    const session = await api.post<SessionResponse>('/auth/login', input);
    setAccessToken(session.accessToken);
    setUser(session.user);
    return session.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const session = await api.post<SessionResponse>('/auth/register', input);
    setAccessToken(session.accessToken);
    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post<void>('/auth/logout');
    } finally {
      // clear locally even if the request failed, so the user is not stuck in the app
      setAccessToken(null);
      setUser(null);
      clearQueryCache();
    }
  }, []);

  const hasRole = useCallback((...roles: Role[]) => !!user && roles.includes(user.role), [user]);

  const value = useMemo<AuthState>(
    () => ({ user, isBootstrapping, login, register, logout, hasRole }),
    [user, isBootstrapping, login, register, logout, hasRole],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
};

export const useAuth = (): AuthState => {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

// for screens that only render behind a guard, so user is known to exist
export const useCurrentUser = (): PublicUser => {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser used outside an authenticated route');
  return user;
};