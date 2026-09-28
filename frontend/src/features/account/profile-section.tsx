// frontend/src/features/account/profile-section.tsx
//
// the signed in user's name and phone. email is the sign in identity, so it is shown but
// changed only by the centre

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { personName, sgPhone } from '@tuition/shared';
import { toast } from 'sonner';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { useUpdateProfile } from '@/api/queries/account';
import { useCurrentUser } from '@/auth/context';
import { TextField } from '@/components/form/text-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { applyServerErrors, fromText } from '@/lib/form';

const profileFormSchema = z.object({
  firstName: personName,
  lastName: personName,
  phone: fromText(sgPhone),
});

export const ProfileSection = () => {
  const user = useCurrentUser();
  const update = useUpdateProfile();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<z.input<typeof profileFormSchema>, unknown, z.output<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { firstName: user.first_name, lastName: user.last_name, phone: user.phone ?? '' },
  });

  const submit = form.handleSubmit(async values => {
    setFormError(null);
    try {
      const { user: saved } = await update.mutateAsync(values);
      // the saved values become the form's new starting point, so save is disabled again
      form.reset({ firstName: saved.first_name, lastName: saved.last_name, phone: saved.phone ?? '' });
      toast.success('Your details have been saved');
    } catch (err) {
      if (!applyServerErrors(form.setError, err)) setFormError(errorMessage(err));
    }
  });

  const { isDirty, isSubmitting } = form.formState;

  return (
    <section aria-labelledby="profile-heading">
      <h2 id="profile-heading" className="mb-3 text-sm font-semibold">Your details</h2>
      <Card>
        <CardContent>
          <form onSubmit={submit} noValidate className="space-y-6">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField control={form.control} name="firstName" label="First name" autoComplete="given-name" />
                <TextField control={form.control} name="lastName" label="Last name" autoComplete="family-name" />
              </div>
              <TextField
                control={form.control} name="phone" label="Phone (optional)" type="tel" autoComplete="tel"
                description="A Singapore number the centre can reach you on."
              />
            </FieldGroup>
            <p className="text-sm text-muted-foreground">
              You sign in as {user.email}. To change it, contact the centre.
            </p>
            <div className="flex justify-end">
              {/* nothing to save until something has changed */}
              <Button type="submit" disabled={!isDirty || isSubmitting}>{isSubmitting ? 'Saving' : 'Save'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
};