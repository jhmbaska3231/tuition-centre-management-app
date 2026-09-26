// frontend/src/features/parent/classes/waitlist-tab.tsx
//
// every child's place on every waitlist. offers come first, with how long is left to reply,
// since they expire. declining an offer leaves the waitlist, and the seat passes to the next
// family straight away

import { Hourglass } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { WaitlistEntry } from '@tuition/shared';
import { toast } from 'sonner';
import { useAcceptOffer, useLeaveWaitlist, useWaitlist } from '@/api/queries/enrollment';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/use-now';
import { formatDateTime, formatTimeLeft } from '@/lib/format';
import { cn } from '@/lib/utils';

// under this long, the countdown turns amber
const URGENT_MS = 6 * 3_600_000;

type WaitlistDialog = 'accept' | 'leave';

const OfferCard = ({ entry, now, onAccept, onDecline }: {
  entry: WaitlistEntry;
  now: number;
  onAccept: () => void;
  onDecline: () => void;
}) => {
  const msLeft = entry.offer_expires_at ? new Date(entry.offer_expires_at).getTime() - now : 0;
  // an offer past its deadline can still show as offered until the nightly job sweeps it. the
  // api would refuse to accept it, so it is shown as expired instead
  const expired = msLeft <= 0;
  return (
    <Card className={cn(!expired && 'border-warning bg-warning-bg')}>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className={cn('font-medium', !expired && 'text-warning-fg')}>A seat is available in {entry.course_name}</p>
          <p className="mt-1 text-sm">Offered to {entry.student_name}.</p>
          {expired ? (
            <p className="mt-1 text-sm text-muted-foreground">This offer has expired. The seat goes to the next family.</p>
          ) : (
            <p className="mt-1 text-sm">
              <span className={cn('font-medium', msLeft < URGENT_MS && 'text-warning-fg')}>
                Reply within {formatTimeLeft(msLeft)}
              </span>
              {entry.offer_expires_at && `, by ${formatDateTime(entry.offer_expires_at)}`}
            </p>
          )}
        </div>
        {!expired && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onDecline}>Decline</Button>
            <Button onClick={onAccept}>Accept seat</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const WaitingRow = ({ entry, onLeave }: { entry: WaitlistEntry; onLeave: () => void }) => (
  <li className="flex items-center justify-between gap-3 px-4 py-3">
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{entry.course_name}</p>
      <p className="text-sm text-muted-foreground">{entry.student_name}, number {entry.position} in line</p>
    </div>
    <Button variant="ghost" size="sm" className="shrink-0" onClick={onLeave}>Leave</Button>
  </li>
);

export const WaitlistTab = () => {
  const waitlist = useWaitlist();
  const accept = useAcceptOffer();
  const leave = useLeaveWaitlist();
  const navigate = useNavigate();
  const now = useNow();

  // one dialog at a time, about one entry. closing clears the dialog but keeps the target, so
  // its text does not blank out while it animates closed
  const [dialog, setDialog] = useState<WaitlistDialog | null>(null);
  const [target, setTarget] = useState<WaitlistEntry | null>(null);
  const openFor = (kind: WaitlistDialog, entry: WaitlistEntry) => {
    setTarget(entry);
    setDialog(kind);
  };
  const closeOnDismiss = (open: boolean) => { if (!open) setDialog(null); };

  return (
    <>
      <QueryState
        query={waitlist}
        skeleton={<Skeleton className="h-32" />}
        empty={
          <EmptyState
            icon={Hourglass}
            title="No children on a waitlist"
            description="When a class is full, you can join its waitlist from the class page."
          />
        }
      >
        {entries => {
          const offers = entries.filter(entry => entry.status === 'offered');
          const waiting = entries.filter(entry => entry.status === 'waiting');
          return (
            <div className="flex flex-col gap-6">
              {offers.length > 0 && (
                <div className="flex flex-col gap-3">
                  {offers.map(entry => (
                    <OfferCard
                      key={entry.id} entry={entry} now={now}
                      onAccept={() => openFor('accept', entry)} onDecline={() => openFor('leave', entry)}
                    />
                  ))}
                </div>
              )}
              {waiting.length > 0 && (
                <section aria-labelledby="waiting-heading">
                  <h2 id="waiting-heading" className="mb-3 text-sm font-semibold">Waiting for a seat</h2>
                  <Card className="py-0">
                    <ul className="divide-y">
                      {waiting.map(entry => <WaitingRow key={entry.id} entry={entry} onLeave={() => openFor('leave', entry)} />)}
                    </ul>
                  </Card>
                </section>
              )}
            </div>
          );
        }}
      </QueryState>

      {target && (
        <>
          <ConfirmDialog
            open={dialog === 'accept'}
            onOpenChange={closeOnDismiss}
            title={`Accept the seat in ${target.course_name}?`}
            description={`${target.student_name} is enrolled straight away, and the first invoice covers only the classes from their start date.`}
            confirmLabel="Accept seat"
            pendingLabel="Accepting"
            onConfirm={async () => {
              const enrollment = await accept.mutateAsync(target.id);
              toast.success(`${target.student_name} is enrolled in ${target.course_name}`);
              navigate(`/parent/children/${enrollment.student_id}`);
            }}
          />
          <ConfirmDialog
            open={dialog === 'leave'}
            onOpenChange={closeOnDismiss}
            title={target.status === 'offered' ? 'Decline the seat?' : 'Leave the waitlist?'}
            description={target.status === 'offered'
              ? `Declining removes ${target.student_name} from the waitlist for ${target.course_name}, and the seat is offered to the next family.`
              : `${target.student_name} will lose their place in line for ${target.course_name}.`}
            confirmLabel={target.status === 'offered' ? 'Decline' : 'Leave waitlist'}
            pendingLabel={target.status === 'offered' ? 'Declining' : 'Leaving'}
            destructive
            onConfirm={async () => {
              await leave.mutateAsync(target.id);
              toast.success(target.status === 'offered'
                ? `The seat in ${target.course_name} has been declined`
                : `${target.student_name} has left the waitlist for ${target.course_name}`);
            }}
          />
        </>
      )}
    </>
  );
};