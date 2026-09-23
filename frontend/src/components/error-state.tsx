// frontend/src/components/error-state.tsx

import { CircleAlert } from 'lucide-react';
import { ApiError, NetworkError, errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

// retrying only helps when the failure could be temporary. a 403 or 404 fails the same
// way every time, so offering a retry there invites pointless clicks. istransient already
// encodes which api errors are worth repeating
const canRetry = (error: unknown) =>
  error instanceof NetworkError || (error instanceof ApiError && error.isTransient);

export const ErrorState = ({ error, onRetry, retrying = false, className }: ErrorStateProps) => (
  <div role="alert" className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
    <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-danger-bg">
      <CircleAlert className="size-5 text-danger" aria-hidden />
    </div>
    <p className="max-w-sm text-sm">{errorMessage(error)}</p>
    {onRetry && canRetry(error) && (
      <Button variant="outline" className="mt-4" onClick={onRetry} disabled={retrying}>
        {retrying ? 'Retrying' : 'Try again'}
      </Button>
    )}
  </div>
);