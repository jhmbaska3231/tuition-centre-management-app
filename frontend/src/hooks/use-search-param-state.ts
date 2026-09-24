// frontend/src/hooks/use-search-param-state.ts
//
// filters, tabs and date ranges live in the url, so a view survives a reload and can be
// shared as a link. defaults are left out of the url to keep links short

import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

interface UpdateOptions {
  // replace the current history entry rather than adding one, so back leaves the page
  // instead of stepping through every filter change. week by week navigation, where back
  // should return to the previous week, passes false
  replace?: boolean;
}

// several params in one navigation. react router does not queue search param updates the
// way react queues state: two updates in the same event each start from the same old url,
// and the second silently undoes the first. a date range changing from and to together
// must go through here
export const useUpdateSearchParams = () => {
  const [, setSearchParams] = useSearchParams();
  return useCallback(
    (updates: Record<string, string | null>, { replace = true }: UpdateOptions = {}) => {
      setSearchParams(current => {
        const next = new URLSearchParams(current);
        for (const [name, value] of Object.entries(updates)) {
          if (value === null || value === '') next.delete(name);
          else next.set(name, value);
        }
        return next;
      }, { replace });
    },
    [setSearchParams],
  );
};

interface SearchParamStateOptions<T extends string> extends UpdateOptions {
  // the accepted values. anything else in the url, from an old link or a hand edit, reads
  // as the default rather than reaching the api as an invalid filter
  allowed?: readonly T[];
}

const isAllowed = <T extends string>(allowed: readonly T[], value: string): value is T =>
  (allowed as readonly string[]).includes(value);

// like usestate, but held in one url search param. t is inferred from allowed when it is
// given, and is a plain string otherwise
export const useSearchParamState = <T extends string = string>(
  name: string,
  defaultValue: NoInfer<T>,
  { allowed, replace }: SearchParamStateOptions<T> = {},
) => {
  const [searchParams] = useSearchParams();
  const update = useUpdateSearchParams();

  const raw = searchParams.get(name);
  let value: T = defaultValue;
  if (raw !== null) {
    if (!allowed) value = raw as T; // no allowed list means t is string, so any value fits
    else if (isAllowed(allowed, raw)) value = raw;
  }

  const setValue = useCallback(
    (next: T) => update({ [name]: next === defaultValue ? null : next }, { replace }),
    [update, name, defaultValue, replace],
  );

  return [value, setValue] as const;
};