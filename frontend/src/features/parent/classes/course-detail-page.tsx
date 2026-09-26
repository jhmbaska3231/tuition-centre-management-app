// frontend/src/features/parent/classes/course-detail-page.tsx
//
// one class in full, for the child chosen on the classes page. parents cannot list sessions of
// a course their child is not in, so the schedule is shown as weekly slots and term dates

import { ChevronLeft, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { uuid } from '@tuition/shared';
import type { Course, Student } from '@tuition/shared';
import { useCourse } from '@/api/queries/courses';
import { useEnrollments, useWaitlist } from '@/api/queries/enrollment';
import { useMyStudents } from '@/api/queries/students';
import { DetailList } from '@/components/detail-list';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { QueryState } from '@/components/query-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParamState } from '@/hooks/use-search-param-state';
import { formatDate, formatFee, formatSlot, todayInCentre } from '@/lib/format';
import { courseState, type CourseState } from './course-state';
import { EnrollDialog, type EnrollStage } from './enroll-dialog';

const BackLink = ({ studentId }: { studentId: string }) => (
  <Link
    to={studentId ? `/parent/classes?student=${studentId}` : '/parent/classes'}
    className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
  >
    <ChevronLeft className="size-4" aria-hidden /> Classes
  </Link>
);

const CourseNotFound = () => (
  <EmptyState
    icon={SearchX}
    title="Class not found"
    description="This class may have closed, or the link is no longer valid."
    action={<Link to="/parent/classes" className={buttonVariants({ variant: 'outline' })}>Back to classes</Link>}
  />
);

interface ActionPanelProps {
  course: Course;
  student: Student | undefined;
  state: CourseState | null;
  onEnroll: () => void;
  onJoin: () => void;
}

// the one thing this child can do with this class, or a plain sentence saying why not. every
// case the api would refuse is caught here first, so no button leads to an error
const ActionPanel = ({ course, student, state, onEnroll, onJoin }: ActionPanelProps) => {
  const row = (message: string, action?: React.ReactNode) => (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">{message}</p>
        {action && <div className="shrink-0">{action}</div>}
      </CardContent>
    </Card>
  );

  if (!student) {
    return row('Add a child to your account to enrol them in classes.',
      <Link to="/parent/children?add=1" className={buttonVariants()}>Add a child</Link>);
  }
  const name = student.first_name;
  if (course.status !== 'open' || (course.ends_on !== null && course.ends_on < todayInCentre())) {
    return row('This class is not open for enrolment.');
  }
  // reachable through a pasted link: the browse list only shows classes at the child's level
  if (course.level_id !== null && course.level_id !== student.level_id) {
    return row(`This class is for ${course.level_name}, and ${name} is in ${student.level_name ?? 'no level yet'}.`);
  }
  if (state === null) return <Skeleton className="h-16" />;

  switch (state.kind) {
    case 'enrolled':
      return row(`${name} is enrolled in this class.`,
        <Link to={`/parent/enrollments/${state.enrollmentId}`} className={buttonVariants({ variant: 'outline' })}>View enrolment</Link>);
    case 'offered':
      return row(`A seat in this class is being held for ${name}.`,
        <Link to="/parent/classes?tab=waitlist" className={buttonVariants()}>Reply to the offer</Link>);
    case 'waiting':
      return row(`${name} is on the waitlist. We will email you if a seat opens.`);
    case 'full':
      return row('This class is full.', <Button onClick={onJoin}>Join the waitlist</Button>);
    case 'open':
      return row(state.seatsLeft === 1 ? '1 seat left.' : `${state.seatsLeft} seats left.`,
        <Button onClick={onEnroll}>Enrol {name}</Button>);
  }
};

const CourseDetail = ({ courseId }: { courseId: string }) => {
  const course = useCourse(courseId);
  const children = useMyStudents();
  const enrollments = useEnrollments({ status: 'active' });
  const waitlist = useWaitlist();

  const childIds = (children.data ?? []).map(child => child.id);
  const [studentId] = useSearchParamState('student', childIds[0] ?? '', { allowed: childIds });
  const student = children.data?.find(child => child.id === studentId);

  // open and stage are kept separately, so the text does not change while the dialog animates
  // closed. each opening starts the stage afresh
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stage, setStage] = useState<EnrollStage>('enroll');
  const [justFilled, setJustFilled] = useState(false);
  const openDialog = (next: EnrollStage) => {
    setStage(next);
    setJustFilled(false);
    setDialogOpen(true);
  };

  const statusReady = !enrollments.isPending && !waitlist.isPending;

  return (
    <>
      <BackLink studentId={studentId} />
      <QueryState
        query={course}
        skeleton={<div className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-16" /><Skeleton className="h-48" /></div>}
        notFound={<CourseNotFound />}
      >
        {data => {
          const state = student && statusReady
            ? courseState(data, student.id, enrollments.data ?? [], waitlist.data ?? [])
            : null;
          return (
            <>
              <PageHeader title={data.name} description={`${data.subject_name}, ${data.level_name ?? 'all levels'}`} />

              <div className="flex flex-col gap-8">
                <ActionPanel
                  course={data} student={student} state={state}
                  onEnroll={() => openDialog('enroll')} onJoin={() => openDialog('waitlist')}
                />

                <section aria-labelledby="class-details-heading">
                  <h2 id="class-details-heading" className="mb-3 text-sm font-semibold">Details</h2>
                  <Card className="py-0">
                    <CardContent>
                      <DetailList items={[
                        { label: 'Weekly', value: (
                          <ul className="space-y-0.5">{data.slots.map(slot => <li key={slot.id}>{formatSlot(slot)}</li>)}</ul>
                        ) },
                        { label: 'Term', value: `${data.term_name ? `${data.term_name}, ` : ''}${formatDate(data.starts_on)} to ${data.ends_on ? formatDate(data.ends_on) : 'ongoing'}` },
                        { label: 'Branch', value: data.branch_name },
                        { label: 'Tutor', value: data.tutor_name },
                        { label: 'Fee', value: formatFee(data.fee_amount_cents, data.fee_billing_cycle) },
                      ]} />
                    </CardContent>
                  </Card>
                </section>

                {data.description && (
                  <section aria-labelledby="class-about-heading">
                    <h2 id="class-about-heading" className="mb-3 text-sm font-semibold">About this class</h2>
                    <p className="whitespace-pre-line text-sm">{data.description}</p>
                  </section>
                )}
              </div>

              {student && (
                <EnrollDialog
                  course={data} student={student}
                  open={dialogOpen} onOpenChange={setDialogOpen}
                  stage={stage} justFilled={justFilled}
                  onFilled={() => {
                    setStage('waitlist');
                    setJustFilled(true);
                  }}
                />
              )}
            </>
          );
        }}
      </QueryState>
    </>
  );
};

export const CourseDetailPage = () => {
  const { courseId } = useParams();
  // checked before any request, as on the child page: a malformed id reads as not found
  const valid = courseId !== undefined && uuid.safeParse(courseId).success;
  return valid
    ? <CourseDetail key={courseId} courseId={courseId} />
    : <><BackLink studentId="" /><CourseNotFound /></>;
};