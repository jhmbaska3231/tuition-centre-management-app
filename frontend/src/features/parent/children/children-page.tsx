// frontend/src/features/parent/children/children-page.tsx
//
// every child as a card. the add dialog is opened by ?add=1 in the url, so other screens
// can link straight into it

import { Plus, Users } from 'lucide-react';
import { useMyStudents } from '@/api/queries/students';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParamState } from '@/hooks/use-search-param-state';
import { AddChildDialog } from './add-child-dialog';
import { ChildCard } from './child-card';

export const ChildrenPage = () => {
  const children = useMyStudents();
  const [add, setAdd] = useSearchParamState('add', '', { allowed: ['', '1'] });

  return (
    <>
      <PageHeader
        title="Children"
        description="Your children's details, classes and guardians."
        actions={
          <Button onClick={() => setAdd('1')}>
            <Plus className="size-4" aria-hidden /> Add child
          </Button>
        }
      />

      <QueryState
        query={children}
        skeleton={
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        }
        empty={
          <EmptyState
            icon={Users}
            title="No children added yet"
            description="Add your child to browse and enrol in classes."
            action={<Button onClick={() => setAdd('1')}>Add your first child</Button>}
          />
        }
      >
        {data => (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.map(student => <ChildCard key={student.id} student={student} />)}
          </div>
        )}
      </QueryState>

      <AddChildDialog open={add === '1'} onOpenChange={open => setAdd(open ? '1' : '')} />
    </>
  );
};