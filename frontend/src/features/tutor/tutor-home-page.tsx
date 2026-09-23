// frontend/src/features/tutor/tutor-home-page.tsx

import { MapPin, Users } from 'lucide-react';
import { errorMessage } from '@/api/errors';
import { useCurrentUser } from '@/auth/context';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateLong, formatTimeRange, todayInCentre } from '@/lib/format';
import { useSessions } from '@/api/queries/sessions';

export const TutorHomePage = () => {
  const user = useCurrentUser();
  const today = todayInCentre();
  const { data, isPending, error } = useSessions({ from: today, to: today });

  return (
    <>
      <PageHeader title={`Good day, ${user.first_name}`} description={formatDateLong(today)} />

      {error && <Alert variant="destructive"><AlertDescription>{errorMessage(error)}</AlertDescription></Alert>}
      {isPending && <Skeleton className="h-24 w-full" />}

      {data?.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No sessions today.</CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {data?.map(s => (
          <Card key={s.id} className="py-0">
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="text-sm font-medium tabular-nums">{formatTimeRange(s.starts_at, s.ends_at)}</p>
                <p className="mt-1 truncate font-semibold">{s.course_name}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="size-3.5" />{s.branch_name}{s.classroom_name && `, ${s.classroom_name}`}</span>
                  <span className="flex items-center gap-1"><Users className="size-3.5" />{s.roster_count} students</span>
                </div>
              </div>
              <Badge variant={s.status === 'completed' ? 'secondary' : 'outline'} className="capitalize">{s.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
};