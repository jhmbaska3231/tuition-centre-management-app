// frontend/src/auth/guards.tsx

import { Navigate, Outlet, useLocation } from 'react-router';
import type { Role } from '@tuition/shared';
import { useAuth } from './context';
import { homePathFor } from './home-path';

interface FromState { from?: { pathname: string } }

// deliberately empty: a spinner that flashes for 80ms is worse than nothing
const BootstrapScreen = () => (
  <div className="min-h-svh">
    <span className="sr-only">Loading</span>
  </div>
);

export const RequireAuth = () => {
  const { user, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <BootstrapScreen />;
  // remember where they were headed so sign in can return them there
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
};

export const RequireRole = ({ roles }: { roles: Role[] }) => {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) return <BootstrapScreen />;
  if (!user) return <Navigate to="/login" replace />;
  // the wrong role is not an error, it is the wrong door: send them to their own home
  if (!roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />;
  return <Outlet />;
};

// sign in and register bounce an authenticated user onward. this guard owns the
// post login redirect: when login() sets the user, this re renders and navigates, so the
// login page never has to, and there is no race between two navigations
export const RedirectIfAuthenticated = () => {
  const { user, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <BootstrapScreen />;
  if (user) {
    const from = (location.state as FromState | null)?.from?.pathname;
    return <Navigate to={from ?? homePathFor(user.role)} replace />;
  }
  return <Outlet />;
};