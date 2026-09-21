// frontend/src/features/public/landing-page.tsx
//
// minimal by design. the headline and description become per centre settings in a later
// phase, until then the centre's name carries the page

import { Link } from 'react-router';
import { usePublicOrg } from '@/api/queries/org';
import { useAuth } from '@/auth/context';
import { homePathFor } from '@/auth/home-path';
import { buttonVariants } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/use-document-title';

export const LandingPage = () => {
  useDocumentTitle();
  const { data: org } = usePublicOrg();
  const { user, isBootstrapping } = useAuth();
  const name = org?.name ?? 'Tuition Centre';

  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold">{name}</span>
        {!isBootstrapping && (user
          ? <Link to={homePathFor(user.role)} className={buttonVariants({ size: 'sm' })}>Go to dashboard</Link>
          : <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Sign in</Link>)}
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-24">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{name}</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground text-pretty">
          Enroll in classes, follow your child's attendance and progress, and manage fees in one place.
        </p>
        {!isBootstrapping && !user && (
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className={buttonVariants({ size: 'lg' })}>Create an account</Link>
            <Link to="/login" className={buttonVariants({ variant: 'outline', size: 'lg' })}>Sign in</Link>
          </div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-6 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} {name}
      </footer>
    </div>
  );
};