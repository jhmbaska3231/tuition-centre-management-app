// frontend/src/features/parent/makeups/makeups-page.tsx
//
// every child's make up credits: to book, booked, and past. the centre's rules come from the api
// and are stated at the top, so a parent learns them before a credit is lost

import { CalendarCheck } from 'lucide-react';
import { useState } from 'react';
import type { MakeupCredit, MakeupPolicy } from '@tuition/shared';
import { toast } from 'sonner';
import { useMakeupPolicy, useMakeups, useUnbookMakeup } from '@/api/queries/enrollment';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { QueryState } from '@/components/query-state';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/use-now';
import { formatDate, formatDateTime, formatDuration, formatList } from '@/lib/format';
import { statusLabel } from '@/lib/status';
import { MakeupOptionsSheet } from './makeup-options-sheet';

const PolicyNote = ({ policy }: { policy: MakeupPolicy }) => {
  const marks = formatList(policy.eligible_statuses.map(status => statusLabel('attendance', status).toLowerCase()));
  return (
    <Card>
      <CardContent>
        <h2 className="text-sm font-semibold">How make-ups work</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>A class marked {marks} earns a make-up credit.</li>
          <li>Use it on a class at the same level, at any branch, before the credit expires.</li>
          {policy.book_lead_minutes > 0 && (
            <li>
              Book at least {formatDuration(policy.book_lead_minutes)} ahead
              {policy.cancel_lead_minutes > 0 ? `, and cancel up to ${formatDuration(policy.cancel_lead_minutes)} before the class` : ''}.
            </li>
          )}
          {policy.cap_per_term !== null && (
            <li>Up to {policy.cap_per_term} {policy.cap_per_term === 1 ? 'make-up' : 'make-ups'} can be used each term.</li>
          )}
          <li>A booked make-up that is missed, for any reason, uses up the credit.</li>
        </ul>
      </CardContent>
    </Card>
  );
};

// what happened to a past credit, in one line
const historyText = (credit: MakeupCredit) => {
  switch (credit.status) {
    case 'used':
      return `Attended ${credit.booked_course_name ?? 'a make-up'}${credit.booked_at_time ? `, ${formatDate(credit.booked_at_time)}` : ''}`;
    case 'forfeited':
      return `Booked for ${credit.booked_course_name ?? 'a make-up'} and missed`;
    case 'expired':
      return `Not used by ${formatDate(credit.expires_on)}`;
    default:
      return '';
  }
};

export const MakeupsPage = () => {
  const credits = useMakeups();
  const policy = useMakeupPolicy();
  const unbook = useUnbookMakeup();
  const now = useNow();

  // the sheet and the dialog each keep their credit apart from their open state, so their text
  // does not blank out while they animate closed
  const [choosing, setChoosing] = useState<MakeupCredit | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cancelling, setCancelling] = useState<MakeupCredit | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  // inside the notice window the button is replaced by what happens instead. hidden until the
  // policy loads, rather than offered on a guess
  const canCancel = (credit: MakeupCredit) =>
    policy.data !== undefined && credit.booked_at_time !== null
    && now < new Date(credit.booked_at_time).getTime() - policy.data.cancel_lead_minutes * 60_000;

  return (
    <>
      <PageHeader title="Make-up classes" description="Book a class to make up for one your child missed." />

      <div className="flex flex-col gap-8">
        {policy.data && <PolicyNote policy={policy.data} />}

        <QueryState
          query={credits}
          skeleton={<div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>}
          empty={
            <EmptyState
              icon={CalendarCheck}
              title="No make-up credits"
              description="A credit appears here when a missed class earns one."
            />
          }
        >
          {list => {
            const available = list.filter(credit => credit.status === 'available');
            const booked = list.filter(credit => credit.status === 'booked');
            const past = list.filter(credit => ['used', 'expired', 'forfeited'].includes(credit.status));
            return (
              <>
                {available.length > 0 && (
                  <section aria-labelledby="to-book-heading">
                    <h2 id="to-book-heading" className="mb-3 text-sm font-semibold">To book</h2>
                    <div className="flex flex-col gap-3">
                      {available.map(credit => (
                        <Card key={credit.id}>
                          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-medium">{credit.student_name}</p>
                              <p className="text-sm text-muted-foreground">
                                Missed {credit.missed_course_name}, {formatDateTime(credit.missed_at)}
                              </p>
                              <p className="text-sm text-muted-foreground">Use by {formatDate(credit.expires_on)}</p>
                            </div>
                            <Button className="shrink-0" onClick={() => { setChoosing(credit); setSheetOpen(true); }}>
                              Choose a class
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {booked.length > 0 && (
                  <section aria-labelledby="booked-heading">
                    <h2 id="booked-heading" className="mb-3 text-sm font-semibold">Booked</h2>
                    <Card className="py-0">
                      <ul className="divide-y">
                        {booked.map(credit => (
                          <li key={credit.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {credit.student_name}: {credit.booked_course_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {credit.booked_at_time && formatDateTime(credit.booked_at_time)}, making up for {credit.missed_course_name}
                              </p>
                              {!canCancel(credit) && policy.data && (
                                <p className="text-sm text-muted-foreground">
                                  Too close to the class to cancel. If {credit.student_name} cannot come, the credit is used up.
                                </p>
                              )}
                            </div>
                            {canCancel(credit) && (
                              <Button variant="outline" size="sm" className="shrink-0" onClick={() => { setCancelling(credit); setCancelOpen(true); }}>
                                Cancel booking
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </section>
                )}

                {past.length > 0 && (
                  <section aria-labelledby="past-heading">
                    <h2 id="past-heading" className="mb-3 text-sm font-semibold">Past credits</h2>
                    <Card className="py-0">
                      <ul className="divide-y">
                        {past.map(credit => (
                          <li key={credit.id} className="flex items-start justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{credit.student_name}, {credit.missed_course_name}</p>
                              <p className="text-sm text-muted-foreground">{historyText(credit)}</p>
                            </div>
                            <StatusBadge kind="makeup" status={credit.status} />
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </section>
                )}
              </>
            );
          }}
        </QueryState>
      </div>

      {choosing && (
        <MakeupOptionsSheet credit={choosing} policy={policy.data} open={sheetOpen} onOpenChange={setSheetOpen} />
      )}

      {cancelling && (
        <ConfirmDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          title="Cancel this make-up?"
          description={`The credit returns to ${cancelling.student_name}, to book another class before ${formatDate(cancelling.expires_on)}. The class you give up may not be available again.`}
          confirmLabel="Cancel booking"
          pendingLabel="Cancelling"
          cancelLabel="Keep booking"
          destructive
          onConfirm={async () => {
            await unbook.mutateAsync(cancelling.id);
            toast.success(`The make-up for ${cancelling.student_name} has been cancelled`);
          }}
        />
      )}
    </>
  );
};