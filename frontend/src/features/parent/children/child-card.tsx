// frontend/src/features/parent/children/child-card.tsx
//
// one child as a card linking to their page. shared by the children page and home

import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import type { Student } from '@tuition/shared';
import { Card, CardContent } from '@/components/ui/card';
import { fullName } from '@/lib/format';

const classCount = (n: number) => (n === 0 ? 'No classes yet' : n === 1 ? '1 class' : `${n} classes`);

export const ChildCard = ({ student }: { student: Student }) => (
  <Link
    to={`/parent/children/${student.id}`}
    className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <Card className="transition-colors group-hover:bg-muted/50">
      <CardContent className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{fullName(student)}</p>
          <p className="truncate text-sm text-muted-foreground">
            {[student.level_name, student.school].filter(Boolean).join(', ')}
          </p>
          <p className="text-sm text-muted-foreground">{classCount(student.active_enrollment_count)}</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </CardContent>
    </Card>
  </Link>
);