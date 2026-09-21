// frontend/src/auth/provider.tsx

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LoginInput, PublicUser, RegisterInput, Role, SessionResponse } from '@tuition/shared';
import { api, bootstrapSession } from '@/api/client';
import { clearQueryCache } from '@/api/query-client';
import { setAccessToken, subscribeToToken } from '@/api/token-store';
import { AuthContext, type AuthState } from './context';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const bootstrapped = useRef(false);

  // strictmode mounts effects twice in development. a second refresh would present a
  // token the first already rotated, which the backend treats as reuse and revokes the
  // whole session family. the ref makes this run once
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    let cancelled = false;
    bootstrapSession()
      .then(session => { if (!cancelled && session) setUser(session.user); })
      .finally(() => { if (!cancelled) setIsBootstrapping(false); });

    return () => { cancelled = true; };
  }, []);

  // a refresh failing mid session clears the token, mirror that into the user so the
  // guards redirect rather than leaving an empty shell on screen
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
      // clear locally even if the request failed, so the user is never stuck signed in
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