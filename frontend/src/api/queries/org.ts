// frontend/src/api/queries/org.ts

import { useQuery } from '@tanstack/react-query';
import type { PublicOrganisation } from '@tuition/shared';
import { configureFormatting } from '@/lib/format';
import { api } from '../client';
import { keys } from '../keys';

export const usePublicOrg = () =>
  useQuery({
    queryKey: keys.publicOrg,
    queryFn: async () => {
      const org = await api.get<PublicOrganisation>('/org/public');
      // configured here, before the data reaches any component, so the first render of
      // every screen already formats times in the centre's timezone
      configureFormatting({ timezone: org.timezone, currency: org.currency });
      return org;
    },
    staleTime: Infinity,
  });