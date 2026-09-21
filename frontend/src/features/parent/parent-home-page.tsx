// frontend/src/features/parent/parent-home-page.tsx

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router';
import type { BalanceSummary, Student } from '@tuition/shared';
import { api } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { keys } from '@/api/keys';
import { useCurrentUser } from '@/auth/context';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/stat-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fullName, money } from '@/lib/format';

export const ParentHomePage = () => {
  const user = useCurrentUser();
  const children = useQuery({ queryKey: keys.students.mine(), queryFn: () => api.get<Student[]>('/students/mine') });
  const balance = useQuery({ queryKey: keys.invoices.myBalance(), queryFn: () => api.get<BalanceSummary>('/invoices/my-balance') });

  return (
    <>
      <PageHeader title={`Hi, ${user.first_name}`} description="Here is what is happening with your family's classes." />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Outstanding fees" value={balance.data && money(balance.data.outstanding_cents)} loading={balance.isPending} to="/parent/invoices" />
        <StatCard
          label="Overdue" value={balance.data && money(balance.data.overdue_cents)} loading={balance.isPending} to="/parent/invoices"
          tone={balance.data && balance.data.overdue_cents > 0 ? 'danger' : 'default'}
        />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Your children</h2>
          <Link to="/parent/children" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <Plus className="size-4" /> Add child
          </Link>
        </div>

        {children.error && <Alert variant="destructive"><AlertDescription>{errorMessage(children.error)}</AlertDescription></Alert>}

        {children.isPending && <Skeleton className="h-20 w-full" />}

        {children.data?.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm font-medium">No children added yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Add your child to browse and enrol in classes.</p>
              <Link to="/parent/children" className={buttonVariants({ className: 'mt-4' })}>Add your first child</Link>
            </CardContent>
          </Card>
        )}

        {!!children.data?.length && (
          <Card className="gap-0 divide-y py-0">
            {children.data.map(child => (
              <Link key={child.id} to="/parent/children" className="flex items-center justify-between px-5 py-4 hover:bg-muted/40">
                <div>
                  <p className="text-sm font-medium">{fullName(child)}</p>
                  <p className="text-xs text-muted-foreground">
                    {child.level_name ?? 'No level set'} · {child.active_enrollment_count} active {child.active_enrollment_count === 1 ? 'class' : 'classes'}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </Card>
        )}
      </section>
    </>
  );
};