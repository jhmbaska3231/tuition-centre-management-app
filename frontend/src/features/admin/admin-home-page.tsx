// frontend/src/features/admin/admin-home-page.tsx

import { useQuery } from '@tanstack/react-query';
import type { ReportOverview } from '@tuition/shared';
import { api } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { keys } from '@/api/keys';
import { useCurrentUser } from '@/auth/context';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/stat-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { money } from '@/lib/format';

export const AdminHomePage = () => {
  const user = useCurrentUser();
  const { data, isPending, error } = useQuery({
    queryKey: keys.reports.overview(),
    queryFn: () => api.get<ReportOverview>('/reports/overview'),
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={user.role === 'branch_manager' ? 'Figures for the branches you manage.' : `Welcome back, ${user.first_name}.`}
      />
      {error ? (
        <Alert variant="destructive"><AlertDescription>{errorMessage(error)}</AlertDescription></Alert>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active students" value={data?.active_students} loading={isPending} to="/admin/students" />
          <StatCard label="Active enrolments" value={data?.active_enrollments} loading={isPending} />
          <StatCard label="Open courses" value={data?.open_courses} loading={isPending} to="/admin/courses" />
          <StatCard label="Sessions next 7 days" value={data?.sessions_next_7_days} loading={isPending} to="/admin/sessions" />
          {user.role === 'admin' && (
            <>
              <StatCard label="Outstanding fees" value={data?.outstanding_cents != null ? money(data.outstanding_cents) : undefined} loading={isPending} to="/admin/billing" />
              <StatCard
                label="Overdue fees" value={data?.overdue_cents != null ? money(data.overdue_cents) : undefined} loading={isPending} to="/admin/billing"
                tone={data?.overdue_cents ? 'danger' : 'default'}
              />
            </>
          )}
          <StatCard label="Waitlisted" value={data?.waitlisted} loading={isPending} />
          <StatCard
            label="Leave awaiting approval" value={data?.pending_leave_requests} loading={isPending} to="/admin/leave"
            tone={data && data.pending_leave_requests > 0 ? 'danger' : 'default'}
          />
        </div>
      )}
    </>
  );
};