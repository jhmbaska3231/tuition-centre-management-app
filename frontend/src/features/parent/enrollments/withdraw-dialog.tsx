// frontend/src/features/parent/enrollments/withdraw-dialog.tsx
//
// withdrawing from a class. the date it takes effect comes from the api's preview, so the
// parent sees how long they keep paying before confirming

import type { EnrollmentDetail } from '@tuition/shared';
import { toast } from 'sonner';
import { z } from 'zod';
import { useWithdraw } from '@/api/queries/enrollment';
import { TextareaField } from '@/components/form/textarea-field';
import { FormDialog } from '@/components/form-dialog';
import { FieldGroup } from '@/components/ui/field';
import { formatDateLong, todayInCentre } from '@/lib/format';
import { fromText } from '@/lib/form';

const withdrawFormSchema = z.object({
  // keep the limit in step with the shared withdraw schema
  reason: fromText(z.string().trim().max(500)),
});

interface WithdrawDialogProps {
  enrollment: EnrollmentDetail;
  effectiveOn: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WithdrawDialog = ({ enrollment, effectiveOn, open, onOpenChange }: WithdrawDialogProps) => {
  const withdraw = useWithdraw(enrollment.id);
  const immediate = effectiveOn <= todayInCentre();

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Withdraw ${enrollment.student_name} from ${enrollment.course_name}?`}
      description={immediate
        ? 'The withdrawal takes effect today.'
        : `The withdrawal takes effect on ${formatDateLong(effectiveOn)}, the end of the current billing period. ${enrollment.student_name} keeps attending until then, and fees are charged up to that date.`}
      schema={withdrawFormSchema}
      defaultValues={{ reason: '' }}
      submitLabel="Withdraw"
      pendingLabel="Withdrawing"
      onSubmit={async values => {
        const result = await withdraw.mutateAsync({ reason: values.reason ?? undefined });
        // the end of a billing period is often not a class day, so this says what stays true
        // rather than naming a "last class" that may not exist
        toast.success(result.ends_on && result.ends_on > todayInCentre()
          ? `${enrollment.student_name} stays enrolled until ${formatDateLong(result.ends_on)}`
          : `${enrollment.student_name} has been withdrawn`);
      }}
    >
      {form => (
        <FieldGroup>
          <TextareaField
            control={form.control} name="reason" label="Reason (optional)" maxLength={500}
            description="Helps the centre understand why families leave."
          />
        </FieldGroup>
      )}
    </FormDialog>
  );
};