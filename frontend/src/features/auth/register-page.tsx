// frontend/src/features/auth/register-page.tsx

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { registerSchema, sgPhone } from '@tuition/shared';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { useAuth } from '@/auth/context';
import { TextField } from '@/components/form/text-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { applyServerErrors } from '@/lib/form';

// an empty text input yields '', which the shared schema's phone regex would reject.
// the form accepts '' and the submit handler turns it into undefined, so the request
// still validates against the exact shared schema on the server
const registerFormSchema = registerSchema.extend({ phone: sgPhone.optional().or(z.literal('')) });
type RegisterForm = z.input<typeof registerFormSchema>;
type RegisterValues = z.output<typeof registerFormSchema>;

export const RegisterPage = () => {
  useDocumentTitle('Create an account');
  const { register } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegisterForm, unknown, RegisterValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async values => {
    setFormError(null);
    try {
      await register({ ...values, phone: values.phone || undefined });
    } catch (err) {
      if (!applyServerErrors(form.setError, err)) setFormError(errorMessage(err));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create an account</CardTitle>
        <CardDescription>For parents and guardians. You can add your children once you are signed in.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-6">
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
            <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" />
            <TextField
              control={form.control} name="phone" label="Mobile number" type="tel" autoComplete="tel-national"
              description="Optional. 8 digits, used for urgent notices only."
            />
            <TextField
              control={form.control} name="password" label="Password" type="password" autoComplete="new-password"
              description="At least 8 characters."
            />
          </FieldGroup>
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Creating account' : 'Create account'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t text-sm text-muted-foreground">
        Already registered?&nbsp;<Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </CardFooter>
    </Card>
  );
};