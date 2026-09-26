// frontend/src/features/parent/children/guardians-section.tsx
//
// the adults linked to a child. the removal rules are checked from data already on the page,
// so each is explained in the menu before anyone clicks, rather than refused afterwards

import { MoreHorizontal, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Guardian, Student } from '@tuition/shared';
import { toast } from 'sonner';
import { useRemoveGuardian, useUpdateGuardian } from '@/api/queries/students';
import { useCurrentUser } from '@/auth/context';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fullName } from '@/lib/format';
import { AddGuardianDialog, EditGuardianDialog } from './guardian-dialogs';
import { RELATIONSHIP_LABELS } from './relationships';

type GuardianDialog = 'add' | 'edit' | 'billing' | 'remove';

// why a guardian cannot be removed, or null when they can. mirrors the api's two rules
const removeBlockedBy = (guardian: Guardian, guardianCount: number): string | null => {
  if (guardianCount <= 1) return 'A child must keep at least one guardian';
  if (guardian.is_billing_contact) return 'Make someone else the billing contact first';
  return null;
};

export const GuardiansSection = ({ student }: { student: Student }) => {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const update = useUpdateGuardian(student.id);
  const remove = useRemoveGuardian(student.id);

  // which dialog is open, and who it is about. closing clears the dialog but keeps the
  // target, so the text does not blank out while the dialog animates closed
  const [dialog, setDialog] = useState<GuardianDialog | null>(null);
  const [target, setTarget] = useState<Guardian | null>(null);
  const openFor = (kind: GuardianDialog, guardian: Guardian) => {
    setTarget(guardian);
    setDialog(kind);
  };
  const closeOnDismiss = (open: boolean) => { if (!open) setDialog(null); };

  const readOnly = student.archived_at !== null;
  const targetIsSelf = target?.user_id === me.id;

  return (
    <section aria-labelledby="guardians-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="guardians-heading" className="text-sm font-semibold">Guardians</h2>
        {!readOnly && (
          <Button variant="ghost" size="sm" onClick={() => setDialog('add')}>
            <UserPlus className="size-4" aria-hidden /> Add guardian
          </Button>
        )}
      </div>

      <Card className="py-0">
        <ul className="divide-y">
          {student.guardians.map(guardian => {
            const isSelf = guardian.user_id === me.id;
            const blocked = removeBlockedBy(guardian, student.guardians.length);
            return (
              <li key={guardian.user_id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {fullName(guardian)}
                    {isSelf && <span className="font-normal text-muted-foreground">(you)</span>}
                    {guardian.is_billing_contact && <Badge variant="secondary">Billing contact</Badge>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {RELATIONSHIP_LABELS[guardian.relationship]}, {guardian.email}
                  </p>
                  {!guardian.receives_notifications && (
                    <p className="text-sm text-muted-foreground">Not receiving emails about {student.first_name}</p>
                  )}
                </div>

                {!readOnly && (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />} aria-label={`Options for ${fullName(guardian)}`}>
                      <MoreHorizontal className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openFor('edit', guardian)}>Edit</DropdownMenuItem>
                      {!guardian.is_billing_contact && (
                        <DropdownMenuItem onClick={() => openFor('billing', guardian)}>Make billing contact</DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" disabled={blocked !== null} onClick={() => openFor('remove', guardian)}>
                        <span className="flex flex-col">
                          <span>{isSelf ? 'Remove myself' : 'Remove'}</span>
                          {blocked && <span className="text-xs text-muted-foreground">{blocked}</span>}
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <AddGuardianDialog student={student} open={dialog === 'add'} onOpenChange={closeOnDismiss} />

      {target && (
        <>
          <EditGuardianDialog
            student={student} guardian={target} isSelf={targetIsSelf}
            open={dialog === 'edit'} onOpenChange={closeOnDismiss}
          />

          <ConfirmDialog
            open={dialog === 'billing'}
            onOpenChange={closeOnDismiss}
            title={`Make ${target.first_name} the billing contact?`}
            description={`Future invoices for ${student.first_name} will go to ${target.first_name}.`}
            confirmLabel="Make billing contact"
            pendingLabel="Saving"
            onConfirm={async () => {
              await update.mutateAsync({ userId: target.user_id, input: { isBillingContact: true } });
              toast.success(`${target.first_name} is now the billing contact`);
            }}
          />

          <ConfirmDialog
            open={dialog === 'remove'}
            onOpenChange={closeOnDismiss}
            title={targetIsSelf ? `Remove yourself as ${student.first_name}'s guardian?` : `Remove ${target.first_name}?`}
            description={targetIsSelf
              ? `You will no longer see ${student.first_name} on your account. Another guardian or the centre can add you back.`
              : `${target.first_name} will no longer see ${student.first_name} on their account or receive emails about them.`}
            confirmLabel="Remove"
            pendingLabel="Removing"
            destructive
            onConfirm={async () => {
              await remove.mutateAsync(target.user_id);
              toast.success(targetIsSelf ? `You are no longer ${student.first_name}'s guardian` : `${target.first_name} has been removed`);
              // you can no longer view this child, so leave the page. replace, so back does
              // not return to a page that would now say not found
              if (targetIsSelf) navigate('/parent/children', { replace: true });
            }}
          />
        </>
      )}
    </section>
  );
};