// frontend/src/features/auth/login-page.tsx
//
// no navigate() after a successful login: redirectifauthenticated re renders when the
// user is set and sends them onward, including back to the page they originally wanted

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router';
import { loginSchema, type LoginInput } from '@tuition/shared';
import type { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { useAuth, type SignOutReason } from '@/auth/context';
import type { LoginRedirectState } from '@/auth/guards';
import { TextField } from '@/components/form/text-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { applyServerErrors } from '@/lib/form';

type LoginForm = z.input<typeof loginSchema>;

// explanations for arriving here involuntarily. a plain sign out needs none
const NOTICES: Partial<Record<SignOutReason, string>> = {
  password_changed: 'Your password was changed. Sign in again.',
  session_expired: 'Your session expired. Sign in again.',
};

export const LoginPage = () => {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const location = useLocation();
  const reason = (location.state as LoginRedirectState | null)?.reason;
  const notice = reason ? NOTICES[reason] : undefined;
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginForm, unknown, LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async values => {
    setFormError(null);
    try {
      await login(values);
    } catch (err) {
      if (!applyServerErrors(form.setError, err)) setFormError(errorMessage(err));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Sign in</CardTitle>
        <CardDescription>Welcome back. Enter your details to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          {!formError && notice && (
            <Alert>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <FieldGroup>
            <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" />
            <TextField control={form.control} name="password" label="Password" type="password" autoComplete="current-password" />
          </FieldGroup>
          <div className="space-y-3">
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Signing in' : 'Sign in'}
            </Button>
            <Link to="/forgot-password" className="block text-center text-sm text-muted-foreground hover:text-foreground">
              Forgot your password?
            </Link>
          </div>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t text-sm text-muted-foreground">
        New here?&nbsp;<Link to="/register" className="font-medium text-primary hover:underline">Create an account</Link>
      </CardFooter>
    </Card>
  );
};