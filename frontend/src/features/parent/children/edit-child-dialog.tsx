// frontend/src/features/parent/children/edit-child-dialog.tsx
//
// every field of a child, including the home branch and notes the add form leaves out.
// a level change the api refuses comes back as a list of links to the classes in the way

import { isoDate, levelChangeConflictDetailsSchema, personName, studentNotes, studentSchool, uuid } from '@tuition/shared';
import type { LevelChangeConflictDetails, Student } from '@tuition/shared';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { isApiError } from '@/api/errors';
import { useBranches, useLevels } from '@/api/queries/reference';
import { useUpdateStudent } from '@/api/queries/students';
import { DateField } from '@/components/form/date-field';
import { SelectField } from '@/components/form/select-field';
import { TextField } from '@/components/form/text-field';
import { TextareaField } from '@/components/form/textarea-field';
import { FormDialog } from '@/components/form-dialog';
import { FieldGroup } from '@/components/ui/field';
import { todayInCentre, formatDate } from '@/lib/format';
import { fromText, requiredChoice } from '@/lib/form';

const editChildSchema = z.object({
  firstName: personName,
  lastName: personName,
  // required here even though the api allows null: course browsing depends on it
  levelId: requiredChoice('Choose a level'),
  school: fromText(studentSchool),
  dateOfBirth: fromText(isoDate),
  homeBranchId: uuid.nullable(),
  notes: fromText(studentNotes),
});

// the error's details arrive as unknown. parsed rather than trusted, so a change on the api
// side falls back to the plain message instead of breaking the dialog
const levelConflicts = (error: unknown): LevelChangeConflictDetails['courses'] | null => {
  if (!isApiError(error) || error.code !== 'rule_violation') return null;
  const parsed = levelChangeConflictDetailsSchema.safeParse(error.details);
  return parsed.success ? parsed.data.courses : null;
};

// the refusal as a list of the classes in the way. a class with a withdrawal already scheduled
// shows its end date, so the parent knows when to come back, the others link to their page,
// where they can be withdrawn from
const LevelConflict = ({ name, courses }: { name: string; courses: LevelChangeConflictDetails['courses'] }) => (
  <>
    <p>
      {name} is enrolled in classes for their current level. The level can change once all of
      these have ended:
    </p>
    <ul className="mt-2 list-disc space-y-1 pl-5">
      {courses.map(course => (
        <li key={course.enrollmentId}>
          <Link to={`/parent/enrollments/${course.enrollmentId}`} className="font-medium underline underline-offset-2">
            {course.courseName}
          </Link>
          {course.endsOn ? `, ending ${formatDate(course.endsOn)}` : ', withdraw to end it'}
        </li>
      ))}
    </ul>
  </>
);

interface EditChildDialogProps {
  student: Student;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditChildDialog = ({ student, open, onOpenChange }: EditChildDialogProps) => {
  const levels = useLevels();
  const branches = useBranches();
  const update = useUpdateStudent(student.id);

  const levelOptions = (levels.data ?? []).map(level => ({ value: level.id, label: level.name }));
  const branchOptions = (branches.data ?? []).map(branch => ({ value: branch.id, label: branch.name }));

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${student.first_name}`}
      schema={editChildSchema}
      // read on every open, so the form always starts from the child as they are now
      defaultValues={{
        firstName: student.first_name,
        lastName: student.last_name,
        levelId: student.level_id,
        school: student.school ?? '',
        dateOfBirth: student.date_of_birth ?? '',
        homeBranchId: student.home_branch_id,
        notes: student.notes ?? '',
      }}
      submitLabel="Save"
      pendingLabel="Saving"
      mapError={error => {
        const courses = levelConflicts(error);
        return courses ? { kind: 'form', message: <LevelConflict name={student.first_name} courses={courses} /> } : null;
      }}
      onSubmit={async values => {
        await update.mutateAsync(values);
        toast.success(`${values.firstName}'s details have been saved`);
      }}
    >
      {form => (
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="firstName" label="First name" autoComplete="off" />
            <TextField control={form.control} name="lastName" label="Last name" autoComplete="off" />
          </div>
          <SelectField control={form.control} name="levelId" label="Level" placeholder="Choose a level" options={levelOptions} />
          <TextField control={form.control} name="school" label="School (optional)" autoComplete="off" />
          <DateField control={form.control} name="dateOfBirth" label="Date of birth (optional)" max={todayInCentre()} />
          <SelectField
            control={form.control} name="homeBranchId" label="Home branch" options={branchOptions}
            noneLabel="No home branch" description="The branch you usually attend."
          />
          <TextareaField
            control={form.control} name="notes" label="Notes for the centre (optional)" maxLength={2000}
            description="Allergies, learning needs, or anything the tutors should know."
          />
        </FieldGroup>
      )}
    </FormDialog>
  );
};