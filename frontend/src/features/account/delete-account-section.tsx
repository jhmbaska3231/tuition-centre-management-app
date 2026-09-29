// frontend/src/features/account/delete-account-section.tsx
//
// a parent closing their own account. what would block it is checked from data already on the
// page and explained first, as archiving a child is, the api still checks, since the page could
// be a moment out of date

import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useDeleteAccount } from '@/api/queries/account';
import { useMyBalance } from '@/api/queries/billing';
import { useMyStudents } from '@/api/queries/students';
import { TextField } from '@/components/form/text-field';
import { FormDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { money } from '@/lib/format';

// typing the word is deliberate friction for an action that cannot be undone. checked as a
// string, since a literal type would make the form's empty starting value invalid
const deleteFormSchema = z.object({
  password: z.string().min(1, 'Enter your password'),
  confirm: z.string().refine(value => value === 'DELETE', 'Type DELETE in capital letters'),
});

export const DeleteAccountSection = () => {
  const children = useMyStudents();
  const balance = useMyBalance();
  const deleteAccount = useDeleteAccount();
  const [open, setOpen] = useState(false);

  const activeClasses = (children.data ?? []).reduce((sum, child) => sum + child.active_enrollment_count, 0);
  const owed = balance.data?.outstanding_cents ?? 0;
  // the button waits for both, so it is never enabled on a guess
  const ready = children.data !== undefined && balance.data !== undefined;
  const blockers = [
    activeClasses > 0 && `Withdraw your children from ${activeClasses === 1 ? 'their class' : `their ${activeClasses} classes`}.`,
    owed > 0 && `Settle the ${money(owed)} still owed.`,
  ].filter((blocker): blocker is string => typeof blocker === 'string');

  return (
    <section aria-labelledby="delete-heading">
      <h2 id="delete-heading" className="mb-3 text-sm font-semibold">Delete account</h2>
      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm">
            Deleting your account signs you out for good. A child only you look after is archived; a child with
            another guardian stays on their account. Any waitlist places are given up. The centre keeps invoices
            and attendance records.
          </p>
          {blockers.length > 0 && (
            <div className="text-sm">
              <p className="font-medium">Before you can delete your account:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                {blockers.map(blocker => <li key={blocker}>{blocker}</li>)}
              </ul>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="destructive" disabled={!ready || blockers.length > 0} onClick={() => setOpen(true)}>
              Delete my account
            </Button>
          </div>
        </CardContent>
      </Card>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description="This cannot be undone. Enter your password and type DELETE to confirm."
        schema={deleteFormSchema}
        defaultValues={{ password: '', confirm: '' }}
        submitLabel="Delete my account"
        pendingLabel="Deleting"
        destructive
        onSubmit={async ({ password }) => {
          // the check above passed, so the literal the api expects is sent explicitly
          await deleteAccount.mutateAsync({ password, confirm: 'DELETE' });
          toast.success('Your account has been deleted');
        }}
      >
        {form => (
          <FieldGroup>
            <TextField control={form.control} name="password" label="Password" type="password" autoComplete="current-password" />
            <TextField control={form.control} name="confirm" label="Type DELETE to confirm" autoComplete="off" />
          </FieldGroup>
        )}
      </FormDialog>
    </section>
  );
};