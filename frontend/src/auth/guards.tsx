// frontend/src/auth/guards.tsx

import { Navigate, Outlet, useLocation } from 'react-router';
import type { Role } from '@tuition/shared';
import { useAuth, type SignOutReason } from './context';
import { homePathFor } from './home-path';

// what the redirect to sign in carries. from returns the user to the page they wanted,
// including its search params so filtered views survive. reason explains why they are
// signing in again. router state belongs to this one navigation, so a later manual visit
// to /login shows no message
export interface LoginRedirectState {
  from?: { pathname: string; search: string };
  reason?: SignOutReason;
}

// deliberately empty: a spinner that flashes for 80ms is worse than nothing
const BootstrapScreen = () => (
  <div className="min-h-svh">
    <span className="sr-only">Loading</span>
  </div>
);

export const RequireAuth = () => {
  const { user, isBootstrapping, signOutReason } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <BootstrapScreen />;
  if (!user) {
    // a deliberate sign out must not hand a return path to the next person on this device.
    // an expired session, or a first visit to a protected link, returns them where they were
    const deliberate = signOutReason === 'signed_out' || signOutReason === 'password_changed';
    const state: LoginRedirectState = {
      from: deliberate ? undefined : { pathname: location.pathname, search: location.search },
      reason: signOutReason ?? undefined,
    };
    return <Navigate to="/login" state={state} replace />;
  }
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
    const from = (location.state as LoginRedirectState | null)?.from;
    return <Navigate to={from ? `${from.pathname}${from.search}` : homePathFor(user.role)} replace />;
  }
  return <Outlet />;
};