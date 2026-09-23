// frontend/src/components/query-state.tsx

import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { isApiError } from '@/api/errors';
import { ErrorState } from './error-state';

interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  // shaped like the final layout, so the page does not jump when data arrives
  skeleton: ReactNode;
  // shown when isempty says there is nothing to render. omit it to render children anyway
  empty?: ReactNode;
  // defaults to an empty array check, the common case for list endpoints
  isEmpty?: (data: T) => boolean;
  // for detail pages: a missing record renders inside the shell rather than as an error
  notFound?: ReactNode;
  children: (data: T) => ReactNode;
}

const isEmptyArray = (data: unknown) => Array.isArray(data) && data.length === 0;

// decides by whether data exists, not by status. a background refetch that fails keeps
// the last good data in the cache, and showing it is better than replacing a working
// screen with an error the user did nothing to cause
export const QueryState = <T,>({ query, skeleton, empty, isEmpty = isEmptyArray, notFound, children }: QueryStateProps<T>) => {
  const { data, error } = query;

  if (data === undefined) {
    if (query.isError) {
      if (notFound && isApiError(error) && error.code === 'not_found') return <>{notFound}</>;
      return <ErrorState error={error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
    }
    return <>{skeleton}</>;
  }

  if (empty && isEmpty(data)) return <>{empty}</>;
  return <>{children(data)}</>;
};