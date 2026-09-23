// frontend/src/api/query-client.ts

import { QueryClient } from '@tanstack/react-query';
import { ApiError, NetworkError } from './errors';

// reference data (levels, subjects, branches) changes a few times a year. transactional
// data changes constantly. rather than tune every query, the default is a middle ground
// and longlived queries override staletime at the call site
const DEFAULT_STALE_MS = 30_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_MS,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        // never retry a 4xx: the request is wrong, or the user lacks permission, and
        // repeating it just burns the rate limit. 401 is already handled by the client's
        // refresh and retry, so reaching here means the session is genuinely gone
        if (error instanceof ApiError) return error.isTransient && failureCount < 2;
        if (error instanceof NetworkError) return failureCount < 2;
        return false;
      },
      retryDelay: attempt => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      // mutations are never retried automatically. re sending an enrollment or a payment
      // on a timeout risks a duplicate, and the user should decide
      retry: false,
    },
  },
});

// query roots that hold no user data and survive logout. without this the org name
// would be evicted on sign out and the whole app would blank while it refetched
const KEEP_ON_LOGOUT = new Set(['public-org']);

export const clearQueryCache = (): void => {
  queryClient.removeQueries({ predicate: q => !KEEP_ON_LOGOUT.has(String(q.queryKey[0])) });
};

// marks every query under each root key stale and refetches the ones on screen. the
// promise settles once those refetches finish, so a mutation that returns it from
// onsuccess resolves only after the screen already shows fresh data
export const invalidate = (keysToInvalidate: ReadonlyArray<readonly unknown[]>) =>
  Promise.all(keysToInvalidate.map(queryKey => queryClient.invalidateQueries({ queryKey })));