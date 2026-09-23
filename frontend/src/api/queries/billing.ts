// frontend/src/api/queries/billing.ts

import { useQuery } from '@tanstack/react-query';
import type { BalanceSummary } from '@tuition/shared';
import { api } from '../client';
import { keys } from '../keys';

// the signed in parent's outstanding and overdue totals
export const useMyBalance = () =>
  useQuery({
    queryKey: keys.invoices.myBalance(),
    queryFn: () => api.get<BalanceSummary>('/invoices/my-balance'),
  });