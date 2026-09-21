// frontend/src/features/public/not-found-page.tsx

import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/use-document-title';

export const NotFoundPage = () => {
  useDocumentTitle('Page not found');
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-brand-700">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you are looking for does not exist or has moved.
      </p>
      <Link to="/" className={buttonVariants({ variant: 'outline', className: 'mt-6' })}>Back to home</Link>
    </div>
  );
};