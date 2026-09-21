// frontend/src/features/auth/reset-password-page.tsx
//
// reached from the emailed link. a successful reset revokes every session the account
// has, on every device, so the user signs in fresh afterwards

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { password } from '@tuition/shared';
import { z } from 'zod';
import { api } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { TextField } from '@/components/form/text-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { useDocumentTitle } from '@/hooks/use-document-title';

const resetFormSchema = z.object({ password, confirm: z.string() })
  .refine(v => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type ResetForm = z.input<typeof resetFormSchema>;
type ResetValues = z.output<typeof resetFormSchema>;

export const ResetPasswordPage = () => {
  useDocumentTitle('Choose a new password');
  const [params] = useSearchParams();
  const token = params.get('token');
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ResetForm, unknown, ResetValues>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = form.handleSubmit(async values => {
    setFormError(null);
    try {
      await api.post('/auth/password-reset/confirm', { token, password: values.password });
      setDone(true);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  });

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Link is incomplete</CardTitle>
          <CardDescription>This reset link is missing its token. Request a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/forgot-password" className={buttonVariants({ className: 'w-full' })}>Request a new link</Link>
        </CardContent>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Password updated</CardTitle>
          <CardDescription>You have been signed out everywhere. Sign in with your new password.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/login" className={buttonVariants({ className: 'w-full' })}>Sign in</Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Choose a new password</CardTitle>
        <CardDescription>At least 8 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <FieldGroup>
            <TextField control={form.control} name="password" label="New password" type="password" autoComplete="new-password" />
            <TextField control={form.control} name="confirm" label="Confirm password" type="password" autoComplete="new-password" />
          </FieldGroup>
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Updating' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};