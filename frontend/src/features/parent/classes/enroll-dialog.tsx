// frontend/src/features/parent/classes/enroll-dialog.tsx
//
// enrolling, and joining the waitlist when a class is full, in one dialog. if the last seat
// goes while the parent is deciding, the api refuses with waitlistavailable and this dialog
// turns into the waitlist offer instead of showing an error

import { useNavigate } from 'react-router';
import type { Course, Student } from '@tuition/shared';
import { toast } from 'sonner';
import { z } from 'zod';
import { isApiError } from '@/api/errors';
import { useEnroll, useJoinWaitlist } from '@/api/queries/enrollment';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { formatDateLong, formatFee, todayInCentre } from '@/lib/format';

export type EnrollStage = 'enroll' | 'waitlist';

// the refusal that means the class filled between loading the page and confirming. the
// details are parsed rather than trusted, like every error detail
const classFilled = (error: unknown) =>
  isApiError(error)
  && error.code === 'rule_violation'
  && z.object({ waitlistAvailable: z.literal(true) }).safeParse(error.details).success;

interface EnrollDialogProps {
  course: Course;
  student: Student;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: EnrollStage;
  // true once an enroll attempt found the class full, so the waitlist stage can say why
  justFilled: boolean;
  onFilled: () => void;
}

export const EnrollDialog = ({ course, student, open, onOpenChange, stage, justFilled, onFilled }: EnrollDialogProps) => {
  const navigate = useNavigate();
  const enroll = useEnroll();
  const join = useJoinWaitlist();
  const name = student.first_name;

  // the start date the api will set: today, or the course's first day if that is later
  const today = todayInCentre();
  const startsOn = course.starts_on > today ? course.starts_on : today;
  const proRated = course.fee_billing_cycle === 'monthly' || course.fee_billing_cycle === 'per_term';
  const fee = formatFee(course.fee_amount_cents, course.fee_billing_cycle);

  // one dialog whose content follows the stage. switching stage keeps the same dialog open,
  // since only its props change
  const content = stage === 'enroll'
    ? {
        title: `Enrol ${name} in ${course.name}?`,
        description: `${name} starts on ${formatDateLong(startsOn)}. The fee is ${fee}${
          proRated ? ', and the first invoice covers only the classes from that date' : ''}.`,
        confirmLabel: 'Enrol',
        pendingLabel: 'Enrolling',
        onConfirm: async () => {
          try {
            await enroll.mutateAsync({ studentId: student.id, courseId: course.id });
          } catch (error) {
            // the last seat went while the parent was deciding: continue in this dialog as
            // the waitlist offer rather than showing a refusal
            if (classFilled(error)) {
              onFilled();
              return false as const;
            }
            throw error;
          }
          toast.success(`${name} is enrolled in ${course.name}`);
          navigate(`/parent/children/${student.id}`);
        },
      }
    : {
        title: justFilled ? 'That class just filled' : `Join the waitlist for ${course.name}?`,
        description: justFilled
          ? `The last seat was taken while you were deciding. Join the waitlist and we will email you if a seat opens for ${name}.`
          : `${course.name} is full. Join the waitlist and we will email you if a seat opens for ${name}. You will then have a limited time to accept it.`,
        confirmLabel: 'Join waitlist',
        pendingLabel: 'Joining',
        onConfirm: async () => {
          await join.mutateAsync({ studentId: student.id, courseId: course.id });
          toast.success(`${name} is on the waitlist for ${course.name}`);
        },
      };

  return <ConfirmDialog open={open} onOpenChange={onOpenChange} {...content} />;
};