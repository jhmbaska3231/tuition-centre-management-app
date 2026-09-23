// frontend/src/components/confirm-dialog.tsx
//
// asks before an action that cannot be undone. an alert dialog rather than a plain one: it
// is announced as needing a response, and a click outside does not dismiss it. the action
// runs inside the dialog, so a refusal from the server appears where the user made the
// choice, and the dialog closes only once the action has succeeded

import { useRef, useState, type ReactNode } from 'react';
import { errorMessage } from '@/api/errors';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  // rendered inside a paragraph, so keep it to text and inline elements
  description: ReactNode;
  confirmLabel: string;
  // shown while the action runs, as a present participle: "withdrawing"
  pendingLabel: string;
  destructive?: boolean;
  // throw to keep the dialog open with the error shown
  onConfirm: () => Promise<void>;
}

type ConfirmBodyProps = Pick<ConfirmDialogProps, 'confirmLabel' | 'pendingLabel' | 'destructive' | 'onConfirm'> & {
  onBusyChange: (busy: boolean) => void;
  close: () => void;
};

// the dialog unmounts its content on close, so this state starts fresh on every open: a
// refusal from last time never greets the next attempt
const ConfirmBody = ({ confirmLabel, pendingLabel, destructive = false, onConfirm, onBusyChange, close }: ConfirmBodyProps) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const confirm = async () => {
    setError(null);
    setPending(true);
    onBusyChange(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err);
      return;
    } finally {
      onBusyChange(false);
      setPending(false);
    }
    close();
  };

  return (
    <>
      {error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      )}
      <AlertDialogFooter>
        <Button type="button" variant="outline" onClick={close} disabled={pending}>Cancel</Button>
        <Button type="button" variant={destructive ? 'destructive' : 'default'} onClick={() => void confirm()} disabled={pending}>
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </AlertDialogFooter>
    </>
  );
};

export const ConfirmDialog = ({ open, onOpenChange, title, description, ...body }: ConfirmDialogProps) => {
  // true while the action is in flight. closing would not cancel the request, it would only
  // hide the outcome, so escape is ignored until it settles. only read at the moment of a
  // close attempt, so a ref is enough and nothing re renders around it
  const busyRef = useRef(false);
  const setBusy = (busy: boolean) => { busyRef.current = busy; };
  const close = () => onOpenChange(false);

  return (
    <AlertDialog open={open} onOpenChange={next => { if (!busyRef.current) onOpenChange(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmBody {...body} onBusyChange={setBusy} close={close} />
      </AlertDialogContent>
    </AlertDialog>
  );
};