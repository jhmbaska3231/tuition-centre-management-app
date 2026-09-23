// frontend/src/components/detail-list.tsx

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DetailItem {
  label: string;
  value: ReactNode;
}

// null, undefined and empty strings read as missing. zero is a real value and renders as
// itself. format booleans to text before passing them, since react renders false as nothing
const isMissing = (v: ReactNode) => v === null || v === undefined || v === '';

// label above value on narrow screens, side by side from sm up. a real dl, so screen
// readers announce each value together with its label
export const DetailList = ({ items, className }: { items: DetailItem[]; className?: string }) => (
  <dl className={cn('divide-y', className)}>
    {items.map(item => (
      <div key={item.label} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
        <dt className="text-sm text-muted-foreground">{item.label}</dt>
        <dd className="text-sm sm:col-span-2">
          {isMissing(item.value) ? <span className="text-muted-foreground">Not set</span> : item.value}
        </dd>
      </div>
    ))}
  </dl>
);