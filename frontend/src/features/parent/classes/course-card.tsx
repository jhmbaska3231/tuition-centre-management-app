// frontend/src/features/parent/classes/course-card.tsx
//
// one course as a card linking to its detail page, where enrolling happens. the status line
// says where the selected child stands, so nobody meets "already enrolled" as an error

import { Link } from 'react-router';
import type { Course } from '@tuition/shared';
import { Card, CardContent } from '@/components/ui/card';
import { formatFee, formatSlot } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CourseState } from './course-state';

// few enough seats that a parent should decide soon
const LOW_SEATS = 2;

const StatusLine = ({ state }: { state: CourseState }) => {
  switch (state.kind) {
    case 'enrolled':
      return <span className="text-success-fg">Enrolled</span>;
    case 'offered':
      return <span className="text-warning-fg">Seat offered</span>;
    case 'waiting':
      return <span className="text-info-fg">On the waitlist</span>;
    case 'full':
      return <span className="text-danger-fg">Full, join the waitlist</span>;
    case 'open':
      return (
        <span className={cn(state.seatsLeft <= LOW_SEATS ? 'text-warning-fg' : 'text-muted-foreground')}>
          {state.seatsLeft === 1 ? '1 seat left' : `${state.seatsLeft} seats left`}
        </span>
      );
  }
};

interface CourseCardProps {
  course: Course;
  state: CourseState;
  studentId: string;
}

export const CourseCard = ({ course, state, studentId }: CourseCardProps) => (
  <Link
    to={`/parent/classes/${course.id}?student=${studentId}`}
    className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <Card className="h-full transition-colors group-hover:bg-muted/50">
      <CardContent className="flex h-full flex-col gap-3">
        <div className="min-w-0">
          <p className="font-medium">{course.name}</p>
          <p className="text-sm text-muted-foreground">
            {course.branch_name}
            {course.tutor_name ? `, with ${course.tutor_name}` : ''}
          </p>
        </div>
        <ul className="space-y-0.5 text-sm">
          {course.slots.map(slot => <li key={slot.id}>{formatSlot(slot)}</li>)}
        </ul>
        {/* mt-auto pushes this row to the bottom, so cards of different heights line up */}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1 text-sm">
          <span className="font-medium tabular-nums">{formatFee(course.fee_amount_cents, course.fee_billing_cycle)}</span>
          <span className="font-medium"><StatusLine state={state} /></span>
        </div>
      </CardContent>
    </Card>
  </Link>
);