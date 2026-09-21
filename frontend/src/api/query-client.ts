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
      // mutations are never retried automatically. re sending an enrolment or a payment
      // on a timeout risks a duplicate, and the user should decide
      retry: false,
    },
  },
});

// called on logout so a later login cannot see the previous user's cached data
export const clearQueryCache = (): void => {
  queryClient.clear();
};