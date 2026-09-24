// frontend/src/api/queries/reference.ts
//
// centre reference data used to fill selects. it changes rarely, and admin edits invalidate
// these keys, so it is kept fresh for longer than screen data

import { useQuery } from '@tanstack/react-query';
import type { Branch, Level } from '@tuition/shared';
import { api } from '../client';
import { keys } from '../keys';

const REFERENCE_STALE_MS = 5 * 60_000;

export const useLevels = () =>
  useQuery({ queryKey: keys.reference.levels, queryFn: () => api.get<Level[]>('/levels'), staleTime: REFERENCE_STALE_MS });

export const useBranches = () =>
  useQuery({ queryKey: keys.reference.branches, queryFn: () => api.get<Branch[]>('/branches'), staleTime: REFERENCE_STALE_MS });