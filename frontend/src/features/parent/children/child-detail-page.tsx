// frontend/src/features/parent/children/child-detail-page.tsx
//
// one child: their details, their classes, and archiving. guardians are managed on this
// page too, in their own section

import { ChevronLeft, ChevronRight, GraduationCap, Pencil, UserRoundX } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { uuid } from '@tuition/shared';
import type { Enrollment, Student } from '@tuition/shared';
import { toast } from 'sonner';
import { useEnrollments } from '@/api/queries/enrollment';
import { useArchiveStudent, useStudent } from '@/api/queries/students';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DetailList } from '@/components/detail-list';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { QueryState } from '@/components/query-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, fullName } from '@/lib/format';
import { EditChildDialog } from './edit-child-dialog';
import { GuardiansSection } from './guardians-section';

const BackLink = () => (
  <Link to="/parent/children" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
    <ChevronLeft className="size-4" aria-hidden /> Children
  </Link>
);

const ChildNotFound = () => (
  <EmptyState
    icon={UserRoundX}
    title="Child not found"
    description="This child is not on your account, or the link is no longer valid."
    action={<Link to="/parent/children" className={buttonVariants({ variant: 'outline' })}>Back to children</Link>}
  />
);

const attendanceLine = (enrollment: Enrollment) =>
  enrollment.sessions_held > 0 ? `Attended ${enrollment.sessions_attended} of ${enrollment.sessions_held}` : 'No classes held yet';

const ClassList = ({ student, enrollments }: { student: Student; enrollments: Enrollment[] }) => {
  if (enrollments.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="Not in any classes yet"
        description={`Browse the classes available for ${student.first_name}'s level.`}
        action={<Link to={`/parent/classes?student=${student.id}`} className={buttonVariants()}>Browse classes</Link>}
      />
    );
  }
  return (
    <Card className="py-0">
      <ul className="divide-y">
        {enrollments.map(enrollment => (
          <li key={enrollment.id}>
            <Link to={`/parent/enrollments/${enrollment.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{enrollment.course_name}</p>
                <p className="text-sm text-muted-foreground">
                  {enrollment.branch_name}
                  {enrollment.ends_on ? `, ending ${formatDate(enrollment.ends_on)}` : ''}
                </p>
                <p className="text-sm text-muted-foreground">{attendanceLine(enrollment)}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
};

const ChildDetail = ({ studentId }: { studentId: string }) => {
  const navigate = useNavigate();
  // both start at once: each needs only the id from the url, so neither waits on the other
  const student = useStudent(studentId);
  const enrollments = useEnrollments({ studentId, status: 'active' });
  const archive = useArchiveStudent(studentId);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  return (
    <QueryState
      query={student}
      skeleton={<div className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-48" /><Skeleton className="h-32" /></div>}
      notFound={<ChildNotFound />}
    >
      {data => {
        const archived = data.archived_at !== null;
        const activeClasses = data.active_enrollment_count;
        return (
          <>
            <PageHeader
              title={fullName(data)}
              description={data.level_name ?? undefined}
              actions={!archived && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" aria-hidden /> Edit
                </Button>
              )}
            />

            <div className="flex flex-col gap-8">
              {archived && (
                <Alert>
                  <AlertDescription>
                    {data.first_name} has been archived and no longer appears on your account. Contact the centre to restore them.
                  </AlertDescription>
                </Alert>
              )}

              <section aria-labelledby="details-heading">
                <h2 id="details-heading" className="mb-3 text-sm font-semibold">Details</h2>
                <Card className="py-0">
                  <CardContent>
                    <DetailList items={[
                      { label: 'Level', value: data.level_name },
                      { label: 'School', value: data.school },
                      { label: 'Date of birth', value: data.date_of_birth && formatDate(data.date_of_birth) },
                      { label: 'Home branch', value: data.home_branch_name },
                      { label: 'Notes', value: data.notes && <span className="whitespace-pre-line">{data.notes}</span> },
                    ]} />
                  </CardContent>
                </Card>
              </section>

              <section aria-labelledby="classes-heading">
                <h2 id="classes-heading" className="mb-3 text-sm font-semibold">Classes</h2>
                <QueryState query={enrollments} skeleton={<Skeleton className="h-24" />}>
                  {list => <ClassList student={data} enrollments={list} />}
                </QueryState>
              </section>

              <GuardiansSection student={data} />

              {!archived && (
                <section aria-labelledby="archive-heading">
                  <h2 id="archive-heading" className="mb-3 text-sm font-semibold">Archive</h2>
                  <Card>
                    <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {/* the reason is shown before any click. unpaid invoices cannot be known
                          in advance, so that refusal comes back from the api inside the dialog */}
                      <p className="text-sm text-muted-foreground">
                        {activeClasses > 0
                          ? `Withdraw ${data.first_name} from ${activeClasses === 1 ? 'their class' : `their ${activeClasses} classes`} before archiving.`
                          : `Remove ${data.first_name} from your account. Only the centre can restore them.`}
                      </p>
                      <Button variant="outline" className="shrink-0" disabled={activeClasses > 0} onClick={() => setArchiving(true)}>
                        Archive {data.first_name}
                      </Button>
                    </CardContent>
                  </Card>
                </section>
              )}
            </div>

            <EditChildDialog student={data} open={editing} onOpenChange={setEditing} />
            <ConfirmDialog
              open={archiving}
              onOpenChange={setArchiving}
              title={`Archive ${data.first_name}?`}
              description={`${data.first_name} will no longer appear on your account. The centre keeps their records, and only the centre can restore them.`}
              confirmLabel="Archive"
              pendingLabel="Archiving"
              destructive
              onConfirm={async () => {
                await archive.mutateAsync();
                toast.success(`${data.first_name} has been archived`);
                // replace, so back does not return to a child who is no longer on the account
                navigate('/parent/children', { replace: true });
              }}
            />
          </>
        );
      }}
    </QueryState>
  );
};

export const ChildDetailPage = () => {
  const { studentId } = useParams();
  // checked before any request: a malformed id would otherwise reach the api as a 400 and
  // show as an error with a pointless retry, rather than as a child that does not exist
  const valid = studentId !== undefined && uuid.safeParse(studentId).success;
  return (
    <>
      <BackLink />
      {valid ? <ChildDetail key={studentId} studentId={studentId} /> : <ChildNotFound />}
    </>
  );
};