// frontend/src/features/parent/enrollments/enrollment-page.tsx
//
// one child in one class: where they stand, how attendance has gone, the tutor's notes, and
// withdrawing

import { CalendarClock, ChevronLeft, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { uuid } from '@tuition/shared';
import type { AttendanceHistoryEntry, EnrollmentDetail } from '@tuition/shared';
import { useAttendanceHistory, useEnrollment } from '@/api/queries/enrollment';
import { DetailList } from '@/components/detail-list';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { QueryState } from '@/components/query-state';
import { StatusBadge } from '@/components/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/use-now';
import { formatDate, formatDateTime } from '@/lib/format';
import { WithdrawDialog } from './withdraw-dialog';

const EnrollmentNotFound = () => (
  <EmptyState
    icon={SearchX}
    title="Class not found"
    description="This class is not on your account, or the link is no longer valid."
    action={<Link to="/parent/children" className={buttonVariants({ variant: 'outline' })}>Back to children</Link>}
  />
);

// the status line a parent reads first. an active enrollment with an end date is a withdrawal
// that has not taken effect yet
const statusText = (e: EnrollmentDetail) => {
  if (e.status === 'active') return e.ends_on ? `Enrolled, ending ${formatDate(e.ends_on)}` : 'Enrolled';
  if (e.status === 'withdrawn') return e.ends_on ? `Withdrawn, last day ${formatDate(e.ends_on)}` : 'Withdrawn';
  return e.ends_on ? `Completed ${formatDate(e.ends_on)}` : 'Completed';
};

const attendanceText = (e: EnrollmentDetail) =>
  e.sessions_held === 0
    ? 'No classes held yet'
    : `Attended ${e.sessions_attended} of ${e.sessions_held} ${e.sessions_held === 1 ? 'class' : 'classes'}`;

const Note = ({ label, text }: { label: string; text: string }) => (
  <p className="text-sm">
    <span className="font-medium">{label}: </span>
    <span className="whitespace-pre-line text-muted-foreground">{text}</span>
  </p>
);

const HistoryRow = ({ entry }: { entry: AttendanceHistoryEntry }) => (
  <li className="space-y-1 px-4 py-3">
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm font-medium">{formatDateTime(entry.starts_at)}</p>
      {entry.session_status === 'cancelled'
        ? <StatusBadge kind="session" status="cancelled" />
        : entry.status
          ? <StatusBadge kind="attendance" status={entry.status} />
          : <span className="text-sm text-muted-foreground">Not marked yet</span>}
    </div>
    {entry.notes && <Note label="Tutor's note" text={entry.notes} />}
    {entry.lesson_notes && <Note label="Lesson" text={entry.lesson_notes} />}
    {entry.homework && <Note label="Homework" text={entry.homework} />}
  </li>
);

const EnrollmentDetailView = ({ enrollmentId }: { enrollmentId: string }) => {
  // both start at once: each needs only the id from the url
  const enrollment = useEnrollment(enrollmentId);
  const history = useAttendanceHistory(enrollmentId);
  const now = useNow();
  const [withdrawing, setWithdrawing] = useState(false);

  return (
    <QueryState
      query={enrollment}
      skeleton={<div className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-32" /><Skeleton className="h-48" /></div>}
      notFound={<EnrollmentNotFound />}
    >
      {data => (
        <>
          <Link
            to={`/parent/children/${data.student_id}`}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden /> {data.student_name}
          </Link>

          <PageHeader
            title={data.course_name}
            description={`${data.student_name}, ${data.branch_name}`}
            actions={data.withdraw_effective_on && (
              <Button variant="outline" onClick={() => setWithdrawing(true)}>Withdraw</Button>
            )}
          />

          <div className="flex flex-col gap-8">
            <Card className="py-0">
              <CardContent>
                <DetailList items={[
                  { label: 'Status', value: statusText(data) },
                  { label: 'Started', value: formatDate(data.starts_on) },
                  { label: 'Attendance', value: attendanceText(data) },
                ]} />
              </CardContent>
            </Card>

            <section aria-labelledby="history-heading">
              <h2 id="history-heading" className="mb-3 text-sm font-semibold">Classes so far</h2>
              <QueryState query={history} skeleton={<Skeleton className="h-48" />}>
                {entries => {
                  // only classes that have started: an upcoming one would read as "not marked",
                  // as if the tutor had forgotten. iso timestamps compare correctly as text
                  const past = entries
                    .filter(entry => new Date(entry.starts_at).getTime() <= now)
                    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
                  return past.length === 0 ? (
                    <EmptyState
                      icon={CalendarClock}
                      title="No classes yet"
                      description={`The first class is on or after ${formatDate(data.starts_on)}.`}
                    />
                  ) : (
                    <Card className="py-0">
                      <ul className="divide-y">{past.map(entry => <HistoryRow key={entry.session_id} entry={entry} />)}</ul>
                    </Card>
                  );
                }}
              </QueryState>
            </section>
          </div>

          {data.withdraw_effective_on && (
            <WithdrawDialog
              enrollment={data} effectiveOn={data.withdraw_effective_on}
              open={withdrawing} onOpenChange={setWithdrawing}
            />
          )}
        </>
      )}
    </QueryState>
  );
};

export const EnrollmentPage = () => {
  const { enrollmentId } = useParams();
  // checked before any request: a malformed id reads as not found
  const valid = enrollmentId !== undefined && uuid.safeParse(enrollmentId).success;
  return valid ? <EnrollmentDetailView key={enrollmentId} enrollmentId={enrollmentId} /> : <EnrollmentNotFound />;
};