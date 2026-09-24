// frontend/src/components/form-dialog.tsx
//
// a dialog holding one form. it owns the form's lifecycle: a fresh form on every open,
// server validation errors on their fields, anything else above them, a pending label on
// submit, and closing only once the submit has succeeded

import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState, type ReactNode } from 'react';
import { useForm, type DefaultValues, type FieldPath, type FieldValues, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { applyServerErrors } from '@/lib/form';

interface FormDialogProps<TIn extends FieldValues, TOut extends FieldValues> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  // the form's types come from the schema: its input is what the fields hold, its output is
  // what onsubmit receives. a schema is plain data, which typescript infers from reliably
  schema: z.ZodType<TOut, TIn>;
  // read each time the dialog opens. pass a record's current values to edit it. noinfer
  // keeps the types coming from the schema alone: inferred from a literal like
  // { level: null }, the field would be typed as always null
  defaultValues: DefaultValues<NoInfer<TIn>>;
  submitLabel: string;
  // shown while submitting, as a present participle: "saving"
  pendingLabel: string;
  // throw to keep the dialog open. validation errors land on their fields, anything else
  // appears above them
  onSubmit: (values: TOut) => Promise<void>;
  // turns a domain error into something the form can show: a message on one field, or
  // content above the fields, which may include links. return null for the default message.
  // validation errors never reach this, they are mapped onto their fields first
  mapError?: (error: unknown) =>
    | { kind: 'field'; field: FieldPath<NoInfer<TIn>>; message: string }
    | { kind: 'form'; message: ReactNode }
    | null;
  children: (form: UseFormReturn<TIn, unknown, TOut>) => ReactNode;
}

type FormBodyProps<TIn extends FieldValues, TOut extends FieldValues> =
  Omit<FormDialogProps<TIn, TOut>, 'open' | 'onOpenChange' | 'title' | 'description'> & {
    onBusyChange: (busy: boolean) => void;
    close: () => void;
  };

// mounted fresh on every open, because the dialog unmounts its content when it closes. so
// the form starts from defaultvalues each time, with no reset effect and no render of
// stale values first
const FormBody = <TIn extends FieldValues, TOut extends FieldValues>({
  schema, defaultValues, submitLabel, pendingLabel, onSubmit, mapError, children, onBusyChange, close,
}: FormBodyProps<TIn, TOut>) => {
  const form = useForm<TIn, unknown, TOut>({ resolver: zodResolver(schema), defaultValues });
  const [formError, setFormError] = useState<ReactNode>(null);

  const submit = form.handleSubmit(async values => {
    setFormError(null);
    onBusyChange(true);
    try {
      await onSubmit(values);
    } catch (err) {
        if (!applyServerErrors(form.setError, err)) {
        const mapped = mapError?.(err) ?? null;
        if (mapped?.kind === 'field') form.setError(mapped.field, { type: 'server', message: mapped.message });
        else setFormError(mapped?.message ?? errorMessage(err));
      }
      return;
    } finally {
      onBusyChange(false);
    }
    close();
  });

  const submitting = form.formState.isSubmitting;
  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      {children(form)}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={close} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? pendingLabel : submitLabel}</Button>
      </DialogFooter>
    </form>
  );
};

export const FormDialog = <TIn extends FieldValues, TOut extends FieldValues = TIn>({
  open, onOpenChange, title, description, ...body
}: FormDialogProps<TIn, TOut>) => {
  // same guard as confirmdialog: escape or the close button cannot dismiss mid submit. the
  // ref stays in the component that owns it; the body only reports when a submit starts and
  // settles, and the flag is read only when something tries to close the dialog
  const busyRef = useRef(false);
  const setBusy = (busy: boolean) => { busyRef.current = busy; };
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={next => { if (!busyRef.current) onOpenChange(next); }}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <FormBody {...body} onBusyChange={setBusy} close={close} />
      </DialogContent>
    </Dialog>
  );
};