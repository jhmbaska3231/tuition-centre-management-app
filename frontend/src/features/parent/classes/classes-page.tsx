// frontend/src/features/parent/classes/classes-page.tsx
//
// open classes for one child at a time: those at the child's level, plus mixed level ones.
// the child, branch and subject all live in the url, so a filtered view survives a reload
// and can be linked to

import { GraduationCap, Users } from 'lucide-react';
import { Link } from 'react-router';
import type { Student } from '@tuition/shared';
import { useCourses } from '@/api/queries/courses';
import { useEnrollments, useWaitlist } from '@/api/queries/enrollment';
import { useBranches, useSubjects } from '@/api/queries/reference';
import { useMyStudents } from '@/api/queries/students';
import { EmptyState } from '@/components/empty-state';
import { FilterBar, FilterSelect } from '@/components/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { QueryState } from '@/components/query-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParamState, useUpdateSearchParams } from '@/hooks/use-search-param-state';
import { cn } from '@/lib/utils';
import { CourseCard } from './course-card';
import { courseState } from './course-state';

const ChildPicker = ({ students, value, onChange }: {
  students: Student[];
  value: string;
  onChange: (id: string) => void;
}) => (
  <div role="group" aria-label="Show classes for" className="flex flex-wrap gap-2">
    {students.map(student => (
      <Button
        key={student.id}
        type="button"
        size="sm"
        variant={student.id === value ? 'secondary' : 'outline'}
        aria-pressed={student.id === value}
        onClick={() => onChange(student.id)}
      >
        {student.first_name}
        {student.level_name ? `, ${student.level_name}` : ''}
      </Button>
    ))}
  </div>
);

const CardGridSkeleton = () => (
  <div className="grid gap-3 sm:grid-cols-2">
    <Skeleton className="h-44" />
    <Skeleton className="h-44" />
  </div>
);

export const ClassesPage = () => {
  const children = useMyStudents();
  const branches = useBranches();
  const subjects = useSubjects();
  // every child's active enrollments in one request, filtered below, so switching child needs
  // no new request for this
  const enrollments = useEnrollments({ status: 'active' });
  const waitlist = useWaitlist();
  const update = useUpdateSearchParams();

  // each param is checked against what actually exists, so an old or edited link falls back to
  // the default rather than sending an unknown id to the api
  const childIds = (children.data ?? []).map(child => child.id);
  const [studentId, setStudentId] = useSearchParamState('student', childIds[0] ?? '', { allowed: childIds });
  const [branchId, setBranchId] = useSearchParamState('branch', '', {
    allowed: ['', ...(branches.data ?? []).map(branch => branch.id)],
  });
  const [subjectId, setSubjectId] = useSearchParamState('subject', '', {
    allowed: ['', ...(subjects.data ?? []).map(subject => subject.id)],
  });

  // an empty filter is sent as nothing, never as branchid=, which the api would refuse as an
  // invalid id. held until a child is known, since without one the list would mix every
  // child's levels together
  const courses = useCourses(
    { studentId, branchId: branchId || undefined, subjectId: subjectId || undefined },
    { enabled: studentId !== '' },
  );

  // cards wait for the child's status, so none briefly shows "seats left" before flipping to
  // "enrolled". a failed request does not block them: the api still refuses anything invalid
  const statusReady = !enrollments.isPending && !waitlist.isPending;
  const filtered = branchId !== '' || subjectId !== '';
  const child = children.data?.find(c => c.id === studentId);

  return (
    <>
      <PageHeader
        title="Classes"
        description={child
          ? `Open classes for ${child.first_name}'s level, and classes open to every level.`
          : 'Open classes at the centre.'}
      />

      <QueryState
        query={children}
        skeleton={<CardGridSkeleton />}
        empty={
          <EmptyState
            icon={Users}
            title="Add a child first"
            description="Classes are shown for your child's level."
            action={<Link to="/parent/children?add=1" className={buttonVariants()}>Add a child</Link>}
          />
        }
      >
        {list => (
          <div className="flex flex-col gap-6">
            {list.length > 1 && <ChildPicker students={list} value={studentId} onChange={setStudentId} />}

            <FilterBar canClear={filtered} onClear={() => update({ branch: null, subject: null })}>
              <FilterSelect
                label="Branch" allLabel="All branches" value={branchId} onChange={setBranchId}
                options={(branches.data ?? []).map(branch => ({ value: branch.id, label: branch.name }))}
              />
              <FilterSelect
                label="Subject" allLabel="All subjects" value={subjectId} onChange={setSubjectId}
                options={(subjects.data ?? []).map(subject => ({ value: subject.id, label: subject.name }))}
              />
            </FilterBar>

            {statusReady ? (
              <QueryState
                query={courses}
                skeleton={<CardGridSkeleton />}
                empty={filtered ? (
                  <EmptyState
                    icon={GraduationCap}
                    title="No classes match these filters"
                    action={<Button variant="outline" onClick={() => update({ branch: null, subject: null })}>Clear filters</Button>}
                  />
                ) : (
                  <EmptyState
                    icon={GraduationCap}
                    title={`No open classes for ${child?.first_name ?? 'this child'} yet`}
                    description="New classes open each term."
                  />
                )}
              >
                {data => (
                  // while a new child or filter loads, the previous list stays visible but dimmed
                  // and unclickable, so nobody opens a card that belongs to the old selection
                  <div
                    aria-busy={courses.isPlaceholderData}
                    className={cn('grid gap-3 sm:grid-cols-2', courses.isPlaceholderData && 'pointer-events-none opacity-60')}
                  >
                    {data.map(course => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        studentId={studentId}
                        state={courseState(course, studentId, enrollments.data ?? [], waitlist.data ?? [])}
                      />
                    ))}
                  </div>
                )}
              </QueryState>
            ) : (
              <CardGridSkeleton />
            )}
          </div>
        )}
      </QueryState>
    </>
  );
};