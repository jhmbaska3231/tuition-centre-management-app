// frontend/src/features/parent/children/guardian-dialogs.tsx
//
// adding a guardian by email, and editing one. a parent can change their own email
// preference but not another guardian's, which the api enforces as well

import { RELATIONSHIPS, email } from '@tuition/shared';
import type { Guardian, Student } from '@tuition/shared';
import { toast } from 'sonner';
import { z } from 'zod';
import { isApiError } from '@/api/errors';
import { useAddGuardian, useUpdateGuardian } from '@/api/queries/students';
import { SelectField } from '@/components/form/select-field';
import { SwitchField } from '@/components/form/switch-field';
import { TextField } from '@/components/form/text-field';
import { FormDialog } from '@/components/form-dialog';
import { FieldGroup } from '@/components/ui/field';
import { fullName } from '@/lib/format';
import { requiredEnum } from '@/lib/form';
import { relationshipOptions } from './relationships';

// the api gives the same answer whether an address is unknown or belongs to someone who is
// not a parent, so nobody can probe which emails have accounts. the wording says what to do
const NEEDS_ACCOUNT = 'The other parent needs an account first. Ask them to register, then add them here.';

const addGuardianFormSchema = z.object({
  email,
  relationship: requiredEnum(RELATIONSHIPS, 'Choose their relationship'),
});

interface AddGuardianDialogProps {
  student: Student;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddGuardianDialog = ({ student, open, onOpenChange }: AddGuardianDialogProps) => {
  const add = useAddGuardian(student.id);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Add a guardian for ${student.first_name}`}
      description="They will see this child on their account and receive emails about their classes."
      schema={addGuardianFormSchema}
      defaultValues={{ email: '', relationship: null }}
      submitLabel="Add guardian"
      pendingLabel="Adding"
      mapError={error => {
        if (!isApiError(error)) return null;
        if (error.code === 'rule_violation') return { kind: 'field', field: 'email', message: NEEDS_ACCOUNT };
        if (error.code === 'conflict') return { kind: 'field', field: 'email', message: `Already a guardian of ${student.first_name}` };
        return null;
      }}
      onSubmit={async values => {
        await add.mutateAsync(values);
        toast.success(`Guardian added for ${student.first_name}`);
      }}
    >
      {form => (
        <FieldGroup>
          <TextField
            control={form.control} name="email" label="Their email" type="email" autoComplete="off"
            description="The address they use to sign in here."
          />
          <SelectField control={form.control} name="relationship" label="Their relationship" placeholder="Choose" options={relationshipOptions} />
        </FieldGroup>
      )}
    </FormDialog>
  );
};

const editGuardianFormSchema = z.object({
  relationship: requiredEnum(RELATIONSHIPS, 'Choose a relationship'),
  receivesNotifications: z.boolean(),
});

interface EditGuardianDialogProps {
  student: Student;
  guardian: Guardian;
  isSelf: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditGuardianDialog = ({ student, guardian, isSelf, open, onOpenChange }: EditGuardianDialogProps) => {
  const update = useUpdateGuardian(student.id);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isSelf ? `Your details for ${student.first_name}` : `Edit ${fullName(guardian)}`}
      schema={editGuardianFormSchema}
      defaultValues={{ relationship: guardian.relationship, receivesNotifications: guardian.receives_notifications }}
      submitLabel="Save"
      pendingLabel="Saving"
      onSubmit={async values => {
        // the email preference is only ever sent for your own row
        const input = isSelf ? values : { relationship: values.relationship };
        await update.mutateAsync({ userId: guardian.user_id, input });
        toast.success('Guardian details saved');
      }}
    >
      {form => (
        <FieldGroup>
          <SelectField control={form.control} name="relationship" label="Relationship" options={relationshipOptions} />
          {isSelf && (
            <SwitchField
              control={form.control} name="receivesNotifications" label={`Emails about ${student.first_name}`}
              description="Cancellations, absences and changes to their classes."
            />
          )}
        </FieldGroup>
      )}
    </FormDialog>
  );
};