// frontend/src/features/parent/parent-home-page.tsx
//
// ordered by urgency: things to act on first, then balances, then what is coming up, then
// the children. each section loads and fails on its own, so one slow or failing request
// never blanks the rest of the page

import { CalendarClock, Plus, Users } from 'lucide-react';
import { Link } from 'react-router';
import type { MakeupCredit, Session, Student, WaitlistEntry } from '@tuition/shared';
import { useMyBalance } from '@/api/queries/billing';
import { useMakeups, useWaitlist } from '@/api/queries/enrollment';
import { useSessions } from '@/api/queries/sessions';
import { useMyStudents } from '@/api/queries/students';
import { useCurrentUser } from '@/auth/context';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { QueryState } from '@/components/query-state';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/use-now';
import { addDays, formatDate, formatDateTime, formatList, money, todayInCentre } from '@/lib/format';
import { ChildCard } from './children/child-card';

type OpenOffer = WaitlistEntry & { offer_expires_at: string };

// an offer past its expiry is left out even before the nightly job marks it expired, since
// accepting it would only be refused
const isOpenOffer = (entry: WaitlistEntry, now: number): entry is OpenOffer =>
  entry.status === 'offered' && entry.offer_expires_at !== null && new Date(entry.offer_expires_at).getTime() > now;

const OfferCards = ({ entries, now }: { entries: WaitlistEntry[]; now: number }) => {
  const offers = entries.filter((entry): entry is OpenOffer => isOpenOffer(entry, now));
  return offers.map(offer => (
    <Card key={offer.id} className="border-warning bg-warning-bg">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-warning-fg">A seat is available in {offer.course_name}</p>
          <p className="mt-1 text-sm">
            Offered to {offer.student_name}. Accept by {formatDateTime(offer.offer_expires_at)}.
          </p>
        </div>
        <Link to="/parent/classes?tab=waitlist" className={buttonVariants({ className: 'shrink-0' })}>
          Review offer
        </Link>
      </CardContent>
    </Card>
  ));
};

const MakeupCard = ({ credits }: { credits: MakeupCredit[] }) => {
  if (credits.length === 0) return null;
  // the earliest expiry is the one to act on first. iso dates compare correctly as text
  const soonest = credits.map(credit => credit.expires_on).reduce((a, b) => (a < b ? a : b));
  const students = formatList([...new Set(credits.map(credit => credit.student_name))]);
  const count = credits.length === 1 ? '1 make-up class' : `${credits.length} make-up classes`;
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{count} to book for {students}</p>
          <p className="mt-1 text-sm text-muted-foreground">Use by {formatDate(soonest)}</p>
        </div>
        <Link to="/parent/makeups" className={buttonVariants({ variant: 'outline', className: 'shrink-0' })}>
          Book
        </Link>
      </CardContent>
    </Card>
  );
};

// the next five across all children. the range starts today, so a class that already
// finished this morning is filtered out here. cancelled sessions stay, with their badge,
// since a parent needs to know the class is not happening
const UpcomingList = ({ sessions, childNames, labelChildren, now }: {
  sessions: Session[];
  childNames: Map<string, string>;
  labelChildren: boolean;
  now: number;
}) => {
  const next = sessions.filter(session => new Date(session.ends_at).getTime() > now).slice(0, 5);
  if (next.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No classes in the next two weeks"
        description="Classes your children are enrolled in will appear here."
      />
    );
  }
  return (
    <Card className="py-0">
      <ul className="divide-y">
        {next.map(session => {
          const names = (session.viewer_student_ids ?? [])
            .map(id => childNames.get(id))
            .filter((name): name is string => name !== undefined);
          return (
            <li key={session.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{session.course_name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(session.starts_at)}, {session.branch_name}
                </p>
                {labelChildren && names.length > 0 && (
                  <p className="text-sm text-muted-foreground">{formatList(names)}</p>
                )}
              </div>
              {session.status === 'cancelled' && <StatusBadge kind="session" status="cancelled" />}
            </li>
          );
        })}
      </ul>
    </Card>
  );
};

const ChildrenList = ({ students }: { students: Student[] }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    {students.map(student => <ChildCard key={student.id} student={student} />)}
  </div>
);

export const ParentHomePage = () => {
  const user = useCurrentUser();
  const now = useNow();
  const today = todayInCentre();

  const children = useMyStudents();
  const balance = useMyBalance();
  const sessions = useSessions({ from: today, to: addDays(today, 13) });
  const waitlist = useWaitlist();
  const makeups = useMakeups({ status: 'available' });

  const childNames = new Map((children.data ?? []).map(child => [child.id, child.first_name]));
  // a family with one child does not need every session labelled with that child's name
  const labelChildren = (children.data?.length ?? 0) > 1;

  return (
    <>
      <PageHeader title={`Hi, ${user.first_name}`} description="Here is what is happening with your family's classes." />

      <div className="flex flex-col gap-8">
        {/*
          things to act on. these render nothing while loading or if they fail: an error box
          for a card that probably would not have appeared is noise, offers are also emailed,
          and the waitlist and make up screens report their own errors
        */}
        <div className="flex flex-col gap-3 empty:hidden">
          {waitlist.data && <OfferCards entries={waitlist.data} now={now} />}
          {makeups.data && <MakeupCard credits={makeups.data} />}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Outstanding fees" value={balance.data && money(balance.data.outstanding_cents)} loading={balance.isPending} to="/parent/invoices" />
          <StatCard
            label="Overdue" value={balance.data && money(balance.data.overdue_cents)} loading={balance.isPending} to="/parent/invoices"
            tone={balance.data && balance.data.overdue_cents > 0 ? 'danger' : 'default'}
          />
        </div>

        <section aria-labelledby="coming-up">
          <h2 id="coming-up" className="mb-3 text-sm font-semibold">Coming up</h2>
          <QueryState query={sessions} skeleton={<Skeleton className="h-48 w-full" />}>
            {data => <UpcomingList sessions={data} childNames={childNames} labelChildren={labelChildren} now={now} />}
          </QueryState>
        </section>

        <section aria-labelledby="your-children">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="your-children" className="text-sm font-semibold">Your children</h2>
            <Link to="/parent/children?add=1" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              <Plus className="size-4" aria-hidden /> Add child
            </Link>
          </div>
          <QueryState
            query={children}
            skeleton={<Skeleton className="h-20 w-full" />}
            empty={
              <EmptyState
                icon={Users}
                title="No children added yet"
                description="Add your child to browse and enroll in classes."
                action={<Link to="/parent/children?add=1" className={buttonVariants()}>Add your first child</Link>}
              />
            }
          >
            {data => <ChildrenList students={data} />}
          </QueryState>
        </section>
      </div>
    </>
  );
};