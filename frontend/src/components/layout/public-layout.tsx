// frontend/src/components/layout/public-layout.tsx

import { Link, Outlet } from 'react-router';
import { usePublicOrg } from '@/api/queries/org';

export const PublicLayout = () => {
  const { data: org } = usePublicOrg();
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="px-6 py-5">
        <Link to="/" className="text-sm font-semibold">{org?.name ?? 'Tuition Centre'}</Link>
      </header>
      <main className="flex flex-1 justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </main>
    </div>
  );
};