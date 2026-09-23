// frontend/src/api/queries/sessions.ts

import { useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import type { listSessionsQuery, Session } from '@tuition/shared';
import { api } from '../client';
import { keys } from '../keys';

// the filter shape is taken from the shared schema the server validates against, so the
// frontend cannot send a filter the api does not accept. the same object builds the cache
// key and the request, so the two cannot drift apart
export type SessionFilters = z.input<typeof listSessionsQuery>;

export const useSessions = (filters: SessionFilters) =>
  useQuery({
    queryKey: keys.sessions.list(filters),
    queryFn: () => api.get<Session[]>('/sessions', filters),
  });