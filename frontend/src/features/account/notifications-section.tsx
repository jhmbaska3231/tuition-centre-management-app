// frontend/src/features/account/notifications-section.tsx
//
// one switch per email the user can receive, saved the moment it changes. an email the centre
// has switched off for everyone stays visible, greyed, still showing the user's own choice

import type { NotificationEvent } from '@tuition/shared';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import { useNotificationPreferences, useSetNotificationPreference } from '@/api/queries/notifications';
import { QueryState } from '@/components/query-state';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// every event, so a new one fails typecheck here until it has words for the screen
const EVENT_TEXT: Record<NotificationEvent, { label: string; description: string }> = {
  session_reminder: { label: 'Class reminders', description: 'The day before each class.' },
  session_cancelled: { label: 'Cancelled classes', description: 'When a class is cancelled.' },
  session_rescheduled: { label: 'Moved classes', description: 'When a class moves to another time.' },
  tutor_changed: { label: 'Tutor changes', description: 'When a different tutor takes a class.' },
  student_absent: { label: 'Absences', description: 'When a child is marked absent.' },
  invoice_issued: { label: 'New invoices', description: 'When an invoice is issued.' },
  invoice_overdue: { label: 'Overdue invoices', description: 'A reminder when an invoice is past its due date.' },
  waitlist_offer: { label: 'Seat offers', description: 'When a seat opens on a waitlist. Offers expire, so this is worth keeping on.' },
  leave_request_submitted: { label: 'Leave requests', description: 'When someone asks for leave.' },
  leave_request_decided: { label: 'Leave decisions', description: 'When your leave request is decided.' },
};

export const NotificationsSection = () => {
  const preferences = useNotificationPreferences();
  const save = useSetNotificationPreference();
  // the change being saved right now, so its switch can show the new value straight away
  const pending = save.isPending ? save.variables : undefined;

  return (
    <section aria-labelledby="notifications-heading">
      <h2 id="notifications-heading" className="mb-3 text-sm font-semibold">Emails</h2>
      <QueryState query={preferences} skeleton={<Skeleton className="h-48" />}>
        {rows => (
          <Card className="py-0">
            <ul className="divide-y">
              {rows.map(row => {
                const id = `email-${row.event_key}`;
                const text = EVENT_TEXT[row.event_key];
                // while saving, the switch shows the value asked for. if the save fails, this
                // falls back to the stored value, so there is nothing to undo by hand
                const checked = pending?.eventKey === row.event_key ? pending.enabled : row.enabled;
                return (
                  <li key={row.event_key} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <Label htmlFor={id} className={cn(!row.org_enabled && 'text-muted-foreground')}>{text.label}</Label>
                      <p className="text-sm text-muted-foreground">
                        {row.org_enabled ? text.description : 'Switched off by the centre for everyone.'}
                      </p>
                    </div>
                    <Switch
                      id={id}
                      checked={checked}
                      // one save at a time: each answer replaces the whole list, so an older
                      // answer arriving last would undo a newer change on screen
                      disabled={!row.org_enabled || save.isPending}
                      onCheckedChange={enabled => save.mutate(
                        { channel: row.channel, eventKey: row.event_key, enabled },
                        { onError: error => toast.error(errorMessage(error)) },
                      )}
                    />
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </QueryState>
    </section>
  );
};