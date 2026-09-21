// frontend/src/features/auth/forgot-password-page.tsx
//
// the backend returns the same response whether or not the email exists, so this page
// shows the same confirmation either way. never reveal which addresses have accounts

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { passwordResetRequestSchema, type PasswordResetRequestInput } from '@tuition/shared';
import type { z } from 'zod';
import { api } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { TextField } from '@/components/form/text-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { useDocumentTitle } from '@/hooks/use-document-title';

type ForgotForm = z.input<typeof passwordResetRequestSchema>;

export const ForgotPasswordPage = () => {
  useDocumentTitle('Reset your password');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ForgotForm, unknown, PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async values => {
    setFormError(null);
    try {
      await api.post('/auth/password-reset/request', values);
      setSentTo(values.email);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Reset your password</CardTitle>
        <CardDescription>
          {sentTo ? 'Check your email.' : 'Enter the email you registered with and we will send you a reset link.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sentTo ? (
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, a reset link is on its
            way. It expires in one hour.
          </p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-6">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <FieldGroup>
              <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" />
            </FieldGroup>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Sending' : 'Send reset link'}
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center border-t text-sm">
        <Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
      </CardFooter>
    </Card>
  );
};