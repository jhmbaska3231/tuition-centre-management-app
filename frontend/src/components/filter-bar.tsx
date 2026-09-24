// frontend/src/components/filter-bar.tsx
//
// the row above a list: selects and a search box. presentational: the screen holds each
// value with usesearchparamstate and passes it in, so the screen reads the very values it
// hands to its query, and nothing here knows about the url

import { Search } from 'lucide-react';
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FilterBarProps {
  children: ReactNode;
  onClear?: () => void;
  // show clear filters only while at least one filter differs from its default
  canClear?: boolean;
}

export const FilterBar = ({ children, onClear, canClear = false }: FilterBarProps) => (
  <div role="search" aria-label="Filters" className="flex flex-wrap items-center gap-2">
    {children}
    {onClear && canClear && (
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>Clear filters</Button>
    )}
  </div>
);

interface FilterSelectProps<T extends string> {
  // the accessible name. a filter bar has no visible labels, so this is what a screen
  // reader announces
  label: string;
  // the option meaning no filter, held as an empty string
  allLabel: string;
  value: T | '';
  onChange: (value: T | '') => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}

export const FilterSelect = <T extends string>({ label, allLabel, value, onChange, options }: FilterSelectProps<T>) => {
  const items = [{ value: '', label: allLabel }, ...options];
  return (
    // stated rather than inferred: base ui reads the value type through a conditional type,
    // and inferred from '' | T inside this generic component it concludes every value is ''
    <Select<T | ''> items={items} value={value} onValueChange={next => onChange(next ?? '')}>
      <SelectTrigger aria-label={label} className="w-full sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map(item => (
          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

interface FilterSearchProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// typing reaches the url 300ms after the last keystroke rather than on every one, so a name
// typed quickly sends one request, not one per letter. the box keeps its own draft
// meanwhile, and adopts a change made elsewhere, such as clear filters
export const FilterSearch = ({ label, value, onChange, placeholder }: FilterSearchProps) => {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }

  // always calls the latest onchange, without being a dependency that would restart the
  // timer every time the parent re renders
  const commit = useEffectEvent((text: string) => onChange(text));
  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => commit(draft), 300);
    return () => clearTimeout(timer);
  }, [draft, value]);

  return (
    <div className="relative w-full sm:w-64">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" aria-label={label} placeholder={placeholder} value={draft} onChange={e => setDraft(e.target.value)} className="pl-8" />
    </div>
  );
};