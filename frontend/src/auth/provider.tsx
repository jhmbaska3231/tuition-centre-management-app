// frontend/src/auth/provider.tsx

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginInput, PublicUser, RegisterInput, Role, SessionResponse } from '@tuition/shared';
import { api, bootstrapSession } from '@/api/client';
import { clearQueryCache } from '@/api/query-client';
import { setAccessToken, subscribeToToken } from '@/api/token-store';
import { AuthContext, type AuthState } from './context';

// one bootstrap per page load, shared by every mount of the provider. strictmode runs
// the effect, its cleanup, then the effect again in development. a ref guard would make
// the second run skip the request while the cleanup discards the first run's result,
// leaving isbootstrapping true forever. with a shared promise each run subscribes to
// the same request, only one refresh is sent, and the surviving run receives the result
let bootstrapPromise: Promise<SessionResponse | null> | null = null;
const bootstrapOnce = () => (bootstrapPromise ??= bootstrapSession());

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let active = true;
    bootstrapOnce()
      .then(session => { if (active && session) setUser(session.user); })
      .finally(() => { if (active) setIsBootstrapping(false); });
    return () => { active = false; };
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
    setSignedOut(false);
    return session.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const session = await api.post<SessionResponse>('/auth/register', input);
    setAccessToken(session.accessToken);
    setUser(session.user);
    setSignedOut(false);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post<void>('/auth/logout');
    } finally {
      // clear locally even if the request failed, so the user is never stuck signed in.
      // the cached bootstrap result is discarded too, otherwise a hot reload remount in
      // development would restore the session that was just ended
      bootstrapPromise = null;
      setAccessToken(null);
      setUser(null);
      setSignedOut(true);
      clearQueryCache();
    }
  }, []);

  const hasRole = useCallback((...roles: Role[]) => !!user && roles.includes(user.role), [user]);

  const value = useMemo<AuthState>(
    () => ({ user, isBootstrapping, signedOut, login, register, logout, hasRole }),
    [user, isBootstrapping, signedOut, login, register, logout, hasRole],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
};