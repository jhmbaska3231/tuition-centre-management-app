// frontend/src/features/account/sessions-section.tsx
//
// signing out of every device at once, for a lost phone or a shared computer

import { useState } from 'react';
import { toast } from 'sonner';
import { useLogoutAll } from '@/api/queries/account';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const SessionsSection = () => {
  const logoutAll = useLogoutAll();
  const [open, setOpen] = useState(false);

  return (
    <section aria-labelledby="devices-heading">
      <h2 id="devices-heading" className="mb-3 text-sm font-semibold">Devices</h2>
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Signed in on a lost phone or a shared computer? Sign out of every device at once, this one included.
          </p>
          <Button variant="outline" className="shrink-0" onClick={() => setOpen(true)}>Sign out everywhere</Button>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sign out of every device?"
        description="Every device signed in to your account is signed out, this one included. You then sign in again here."
        confirmLabel="Sign out everywhere"
        pendingLabel="Signing out"
        onConfirm={async () => {
          await logoutAll.mutateAsync();
          // the toaster sits outside the router, so this is still showing on the sign in page
          toast.success('You have been signed out of every device');
        }}
      />
    </section>
  );
};