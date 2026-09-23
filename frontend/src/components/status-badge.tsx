// frontend/src/components/status-badge.tsx

import type { InvoiceStatus } from '@tuition/shared';
import { Badge } from '@/components/ui/badge';
import { OVERDUE_STYLE, statusStyle, type StatusKind, type StatusKinds, type StatusTone } from '@/lib/status';
import { cn } from '@/lib/utils';

// full class strings, never assembled from pieces. tailwind finds classes by scanning
// source text, so a template like bg-${tone}-bg would never be generated
const TONE_CLASS: Record<StatusTone, string> = {
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
  info: 'bg-info-bg text-info-fg',
  neutral: 'bg-neutral-bg text-neutral-fg',
};

type NonInvoiceKind = Exclude<StatusKind, 'invoice'>;

type StatusBadgeProps = { className?: string } & (
  | { [K in NonInvoiceKind]: { kind: K; status: StatusKinds[K] } }[NonInvoiceKind]
  // overdue applies only while a balance is open, so a paid invoice never shows it
  | { kind: 'invoice'; status: InvoiceStatus; overdue?: boolean }
);

export const StatusBadge = (props: StatusBadgeProps) => {
  const overdue = props.kind === 'invoice' && props.overdue === true
    && (props.status === 'issued' || props.status === 'partially_paid');
  const style = overdue ? OVERDUE_STYLE : statusStyle(props.kind, props.status);
  return <Badge className={cn(TONE_CLASS[style.tone], props.className)}>{style.label}</Badge>;
};