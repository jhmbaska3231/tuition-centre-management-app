// frontend/src/components/empty-state.tsx

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  // a node rather than a label and handler, so it can be a button, a link styled as one,
  // or a dialog trigger
  action?: ReactNode;
  className?: string;
}

// says what an empty list means and what to do next, rather than just "no data"
export const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => (
  <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
    {Icon && (
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>
    )}
    <p className="text-sm font-medium">{title}</p>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);