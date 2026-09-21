// frontend/src/components/stat-card.tsx

import { Link } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value?: string | number;
  hint?: string;
  tone?: 'default' | 'danger';
  to?: string;
  loading?: boolean;
}

export const StatCard = ({ label, value, hint, tone = 'default', to, loading }: StatCardProps) => {
  const body = (
    <Card className={cn('h-full gap-0 py-0', to && 'transition-colors hover:bg-muted/40')}>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading
          ? <Skeleton className="mt-2 h-7 w-20" />
          : <p className={cn('mt-1 text-2xl font-semibold tabular-nums', tone === 'danger' && 'text-danger')}>{value}</p>}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
  if (!to) return body;
  return (
    <Link to={to} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  );
};