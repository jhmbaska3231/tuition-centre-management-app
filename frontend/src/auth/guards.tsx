// frontend/src/auth/guards.tsx

import { Navigate, Outlet, useLocation } from 'react-router';
import type { Role } from '@tuition/shared';
import { useAuth } from './context';

// shown while the initial refresh resolves
const BootstrapScreen = () => (
  <div className="flex min-h-svh items-center justify-center">
    <span className="sr-only">Loading</span>
  </div>
);

export const RequireAuth = () => {
  const { user, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <BootstrapScreen />;

  // remember where they were headed so login can return them there
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return <Outlet />;
};

export const RequireRole = ({ roles }: { roles: Role[] }) => {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) return <BootstrapScreen />;
  if (!user) return <Navigate to="/login" replace />;

  // wrong role is not an error state, it is the wrong door. send them to their own home
  if (!roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />;

  return <Outlet />;
};

// already signed in, so login and register should bounce to the app
export const RedirectIfAuthenticated = () => {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) return <BootstrapScreen />;
  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  return <Outlet />;
};

export const homePathFor = (role: Role): string => {
  switch (role) {
    case 'parent': return '/parent';
    case 'tutor': return '/tutor';
    case 'branch_manager':
    case 'admin': return '/admin';
  }
};