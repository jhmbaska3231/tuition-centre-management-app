// frontend/src/components/form/money-field.tsx
//
// dollars typed as text. the form holds exactly what was typed and the schema converts it
// to cents with moneyInput, so nothing ever rounds or reformats under the cursor. text with
// a decimal keypad rather than type number, which accepts e and signs, changes on mouse
// wheel scroll, and reports half typed input as empty

import { useId } from 'react';
import { Controller, type FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { currencySymbol } from '@/lib/format';
import { describedBy } from '@/lib/form';
import { FieldShell, type FormFieldProps } from './field-shell';

export const MoneyField = <T extends FieldValues, TOut extends FieldValues = T>({
  control, name, label, description, placeholder = '0.00',
}: FormFieldProps<T, TOut> & { placeholder?: string }) => {
  const id = useId();
  const symbol = currencySymbol();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell id={id} label={label} description={description} error={fieldState.error}>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
              {symbol}
            </span>
            <Input
              {...field}
              value={field.value ?? ''}
              id={id}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={placeholder}
              className="tabular-nums"
              // room for the symbol, whose width varies by currency
              style={{ paddingLeft: `calc(${symbol.length}ch + 1rem)` }}
              aria-invalid={fieldState.invalid}
              aria-describedby={describedBy(id, fieldState.invalid, !!description)}
            />
          </div>
        </FieldShell>
      )}
    />
  );
};