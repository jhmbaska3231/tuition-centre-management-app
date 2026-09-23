// frontend/src/api/queries/reports.ts

import { useQuery } from '@tanstack/react-query';
import type { ReportOverview } from '@tuition/shared';
import { api } from '../client';
import { keys } from '../keys';

// dashboard figures. scoped to their branches for branch managers, with fee totals null
export const useReportOverview = () =>
  useQuery({
    queryKey: keys.reports.overview(),
    queryFn: () => api.get<ReportOverview>('/reports/overview'),
  });