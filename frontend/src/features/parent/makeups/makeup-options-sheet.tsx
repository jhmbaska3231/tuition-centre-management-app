// frontend/src/features/parent/makeups/makeup-options-sheet.tsx
//
// the classes one credit could be booked into, in a side sheet. booking needs no confirmation:
// it can be cancelled from the same page. when the term cap is reached, the api refuses the
// list, and that refusal is shown as the explanation it is

import { CalendarX } from 'lucide-react';
import type { MakeupCredit, MakeupPolicy } from '@tuition/shared';
import { toast } from 'sonner';
import { errorMessage, isApiError } from '@/api/errors';
import { useBookMakeup, useMakeupOptions } from '@/api/queries/enrollment';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatDateTime, formatDuration } from '@/lib/format';

interface MakeupOptionsSheetProps {
  credit: MakeupCredit;
  policy: MakeupPolicy | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MakeupOptionsSheet = ({ credit, policy, open, onOpenChange }: MakeupOptionsSheetProps) => {
  // fetched only while the sheet is open, so the list is current each time it is opened
  const options = useMakeupOptions(credit.id, { enabled: open });
  const book = useBookMakeup(credit.id);
  // the option being booked right now, so only its button shows progress
  const bookingId = book.isPending ? book.variables?.sessionId : undefined;

  const body = () => {
    if (options.data === undefined) {
      if (options.isError) {
        // the term cap is a rule, not a failure: shown plainly, without a retry
        if (isApiError(options.error) && options.error.code === 'rule_violation') {
          return <EmptyState icon={CalendarX} title="No make-ups left this term" description={options.error.message} />;
        }
        return <ErrorState error={options.error} onRetry={() => void options.refetch()} retrying={options.isFetching} />;
      }
      return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
    }
    if (options.data.length === 0) {
      return (
        <EmptyState
          icon={CalendarX}
          title="No classes available"
          description={`No class at ${credit.student_name}'s level has a free seat before the credit expires on ${formatDate(credit.expires_on)}${
            policy && policy.book_lead_minutes > 0 ? `. Classes starting within ${formatDuration(policy.book_lead_minutes)} are not shown` : ''}.`}
        />
      );
    }
    return (
      <ul className="divide-y rounded-lg border">
        {options.data.map(option => (
          <li key={option.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{formatDateTime(option.starts_at)}</p>
              <p className="truncate text-sm text-muted-foreground">{option.course_name}, {option.branch_name}</p>
              <p className="text-sm text-muted-foreground">
                {option.seats_left === 1 ? '1 seat left' : `${option.seats_left} seats left`}
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0"
              disabled={book.isPending}
              onClick={async () => {
                await book.mutateAsync({ sessionId: option.id });
                toast.success(`${credit.student_name} is booked into ${option.course_name}, ${formatDateTime(option.starts_at)}`);
                onOpenChange(false);
              }}
            >
              {bookingId === option.id ? 'Booking' : 'Book'}
            </Button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Choose a class for {credit.student_name}</SheetTitle>
          <SheetDescription>
            Make-up for {credit.missed_course_name}. Use by {formatDate(credit.expires_on)}.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          {book.isError && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(book.error)}</AlertDescription>
            </Alert>
          )}
          {body()}
        </div>
      </SheetContent>
    </Sheet>
  );
};