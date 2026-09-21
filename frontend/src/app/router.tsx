// frontend/src/app/router.tsx

import { createBrowserRouter } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth, RequireRole } from '@/auth/guards';
import { AppShell } from '@/components/layout/app-shell';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { PublicLayout } from '@/components/layout/public-layout';
import { AdminHomePage } from '@/features/admin/admin-home-page';
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';
import { ResetPasswordPage } from '@/features/auth/reset-password-page';
import { ParentHomePage } from '@/features/parent/parent-home-page';
import { LandingPage } from '@/features/public/landing-page';
import { NotFoundPage } from '@/features/public/not-found-page';
import { TutorHomePage } from '@/features/tutor/tutor-home-page';

const placeholder = (path: string, title: string) => ({ path, element: <PlaceholderPage title={title} /> });

export const router = createBrowserRouter([
  { path: '/', Component: LandingPage },

  {
    Component: PublicLayout,
    children: [
      {
        Component: RedirectIfAuthenticated,
        children: [
          { path: '/login', Component: LoginPage },
          { path: '/register', Component: RegisterPage },
          { path: '/forgot-password', Component: ForgotPasswordPage },
        ],
      },
      // reachable while signed in too, since the emailed link may open in a logged in tab
      { path: '/reset-password', Component: ResetPasswordPage },
    ],
  },

  {
    Component: RequireAuth,
    children: [
      {
        Component: AppShell,
        children: [
          placeholder('/account', 'Account'),
          {
            element: <RequireRole roles={['parent']} />,
            children: [
              { path: '/parent', Component: ParentHomePage },
              placeholder('/parent/children', 'Children'),
              placeholder('/parent/classes', 'Classes'),
              placeholder('/parent/invoices', 'Invoices'),
              placeholder('/parent/invoices/:invoiceId', 'Invoice'),
            ],
          },
          {
            element: <RequireRole roles={['tutor']} />,
            children: [
              { path: '/tutor', Component: TutorHomePage },
              placeholder('/tutor/schedule', 'Schedule'),
              placeholder('/tutor/leave', 'Leave'),
            ],
          },
          {
            element: <RequireRole roles={['admin', 'branch_manager']} />,
            children: [
              { path: '/admin', Component: AdminHomePage },
              placeholder('/admin/courses', 'Courses'),
              placeholder('/admin/sessions', 'Sessions'),
              placeholder('/admin/students', 'Students'),
              placeholder('/admin/parents', 'Parents'),
              placeholder('/admin/staff', 'Staff'),
              placeholder('/admin/leave', 'Leave'),
              placeholder('/admin/billing', 'Billing'),
            ],
          },
          {
            element: <RequireRole roles={['admin']} />,
            children: [placeholder('/admin/settings', 'Settings')],
          },
        ],
      },
    ],
  },

  { path: '*', Component: NotFoundPage },
]);