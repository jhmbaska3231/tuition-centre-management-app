// frontend/src/features/parent/children/add-child-dialog.tsx
//
// a parent adds their own child. short on purpose: what course browsing needs, plus school
// and date of birth. home branch and notes can be added from the child's page later

import { RELATIONSHIPS, isoDate, personName, studentSchool } from '@tuition/shared';
import { toast } from 'sonner';
import { z } from 'zod';
import { useLevels } from '@/api/queries/reference';
import { useCreateOwnStudent } from '@/api/queries/students';
import { DateField } from '@/components/form/date-field';
import { SelectField } from '@/components/form/select-field';
import { TextField } from '@/components/form/text-field';
import { FormDialog } from '@/components/form-dialog';
import { FieldGroup } from '@/components/ui/field';
import { todayInCentre } from '@/lib/format';
import { fromText, requiredChoice, requiredEnum } from '@/lib/form';
import { relationshipOptions } from './relationships';

// the api's own rules, with the conversions a form needs: selects start empty as null, and
// empty text becomes null rather than an empty string
const addChildSchema = z.object({
  firstName: personName,
  lastName: personName,
  relationship: requiredEnum(RELATIONSHIPS, 'Choose how you are related to your child'),
  levelId: requiredChoice('Choose a level'),
  school: fromText(studentSchool),
  dateOfBirth: fromText(isoDate),
});

interface AddChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddChildDialog = ({ open, onOpenChange }: AddChildDialogProps) => {
  // loaded with the page rather than when the dialog opens, so the level list is ready
  const levels = useLevels();
  const createChild = useCreateOwnStudent();

  const levelOptions = (levels.data ?? []).map(level => ({ value: level.id, label: level.name }));

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a child"
      description="You will be their guardian and the contact for their invoices."
      schema={addChildSchema}
      defaultValues={{ firstName: '', lastName: '', relationship: null, levelId: null, school: '', dateOfBirth: '' }}
      submitLabel="Add child"
      pendingLabel="Adding"
      onSubmit={async values => {
        await createChild.mutateAsync(values);
        toast.success(`${values.firstName} has been added`);
      }}
    >
      {form => (
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* off: the browser would otherwise suggest the parent's own name */}
            <TextField control={form.control} name="firstName" label="First name" autoComplete="off" />
            <TextField control={form.control} name="lastName" label="Last name" autoComplete="off" />
          </div>
          <SelectField control={form.control} name="relationship" label="Your relationship" placeholder="Choose" options={relationshipOptions} />
          <SelectField
            control={form.control} name="levelId" label="Level" placeholder="Choose a level" options={levelOptions}
            description="Classes are shown for this level."
          />
          <TextField control={form.control} name="school" label="School (optional)" autoComplete="off" />
          <DateField control={form.control} name="dateOfBirth" label="Date of birth (optional)" max={todayInCentre()} />
        </FieldGroup>
      )}
    </FormDialog>
  );
};