// frontend/src/features/account/password-section.tsx
//
// changing the password. the api ends every session, this one included, so the page says so
// before the user submits, and the sign in page explains it afterwards

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { password } from '@tuition/shared';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { useChangePassword } from '@/api/queries/account';
import { TextField } from '@/components/form/text-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { applyServerErrors } from '@/lib/form';

// the new password follows the shared rule the api applies. the confirmation exists only on
// the page, to catch a typo in a field the user cannot see
const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: password,
  confirmPassword: z.string(),
})
  .refine(values => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'], message: 'The passwords do not match',
  })
  .refine(values => values.newPassword !== values.currentPassword, {
    path: ['newPassword'], message: 'Choose a password different from your current one',
  });

export const PasswordSection = () => {
  const change = useChangePassword();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<z.input<typeof passwordFormSchema>, unknown, z.output<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const submit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    setFormError(null);
    try {
      // on success this signs out, and the router takes the user to sign in
      await change.mutateAsync({ currentPassword, newPassword });
    } catch (err) {
      if (!applyServerErrors(form.setError, err)) setFormError(errorMessage(err));
    }
  });

  const { isSubmitting } = form.formState;

  return (
    <section aria-labelledby="password-heading">
      <h2 id="password-heading" className="mb-3 text-sm font-semibold">Password</h2>
      <Card>
        <CardContent>
          <form onSubmit={submit} noValidate className="space-y-6">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <FieldGroup>
              <TextField control={form.control} name="currentPassword" label="Current password" type="password" autoComplete="current-password" />
              <TextField control={form.control} name="newPassword" label="New password" type="password" autoComplete="new-password" />
              <TextField control={form.control} name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" />
            </FieldGroup>
            <p className="text-sm text-muted-foreground">
              Changing your password signs you out everywhere, including here. You then sign in again with the new one.
            </p>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Changing' : 'Change password'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
};