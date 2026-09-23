// frontend/src/components/form/date-range-field.tsx
//
// a from and to date with presets. driven by value and onchange rather than wired to
// react-hook-form, because its main home is a filter bar writing to the url. wrap it in a
// controller if a form ever needs one

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addDays, daysBetween, endOfMonth, startOfMonth, startOfWeek, todayInCentre } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface DateRange {
  from: string;
  to: string;
}

interface DateRangeFieldProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  // the longest range allowed, counted as the api counts it: to minus from, in days. pass
  // the api's limit so a range the server would refuse can never be chosen
  maxDays?: number;
  label?: string;
  // keep the label for screen readers but hide it, when a filter bar already makes the
  // purpose obvious
  hideLabel?: boolean;
}

const presets = (today: string): Array<{ label: string; range: DateRange }> => [
  { label: 'This week', range: { from: startOfWeek(today), to: addDays(startOfWeek(today), 6) } },
  { label: 'Next 2 weeks', range: { from: today, to: addDays(today, 13) } },
  { label: 'This month', range: { from: startOfMonth(today), to: endOfMonth(today) } },
];

// the end just set wins, and the other end moves to keep the range ordered and within the
// limit. adjusting beats refusing: the user always keeps the date they picked
const withFrom = (range: DateRange, from: string, maxDays?: number): DateRange => {
  let to = range.to < from ? from : range.to;
  if (maxDays !== undefined && daysBetween(from, to) > maxDays) to = addDays(from, maxDays);
  return { from, to };
};

const withTo = (range: DateRange, to: string, maxDays?: number): DateRange => {
  let from = range.from > to ? to : range.from;
  if (maxDays !== undefined && daysBetween(from, to) > maxDays) from = addDays(to, -maxDays);
  return { from, to };
};

// a native date input reports an empty value while a date is half typed. a controlled
// input that ignored it would be restored to its old value by react, undoing the keystroke,
// so each input keeps a draft of its own and only reports complete dates
const DateInput = ({ id, value, onCommit }: { id: string; value: string; onCommit: (date: string) => void }) => {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  // adopt a change made elsewhere, a preset or the url, during render as react documents
  // for state derived from a prop
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return (
    <Input
      id={id}
      type="date"
      value={draft}
      onChange={e => {
        setDraft(e.target.value);
        if (e.target.value) onCommit(e.target.value);
      }}
      className="w-auto"
    />
  );
};

export const DateRangeField = ({ value, onChange, maxDays, label = 'Dates', hideLabel = false }: DateRangeFieldProps) => {
  const id = useId();
  const options = presets(todayInCentre());

  return (
    <fieldset className="space-y-2">
      <legend className={cn('text-sm font-medium', hideLabel && 'sr-only')}>{label}</legend>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-from`} className="text-xs text-muted-foreground">From</Label>
          <DateInput id={`${id}-from`} value={value.from} onCommit={from => onChange(withFrom(value, from, maxDays))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-to`} className="text-xs text-muted-foreground">To</Label>
          <DateInput id={`${id}-to`} value={value.to} onCommit={to => onChange(withTo(value, to, maxDays))} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(preset => {
          const active = preset.range.from === value.from && preset.range.to === value.to;
          return (
            <Button
              key={preset.label}
              type="button"
              size="sm"
              variant={active ? 'secondary' : 'outline'}
              aria-pressed={active}
              onClick={() => onChange(preset.range)}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
};