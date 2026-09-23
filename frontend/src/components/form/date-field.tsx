// frontend/src/components/form/date-field.tsx
//
// a native date input: mobile friendly, accessible, and it emits yyyy-mm-dd exactly as the
// shared schemas expect. min and max restrict the picker, but typed input can still get
// past them, so the schema remains the real check

import { useId } from 'react';
import { Controller, type FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { describedBy } from '@/lib/form';
import { FieldShell, type FormFieldProps } from './field-shell';

interface DateFieldProps<T extends FieldValues, TOut extends FieldValues> extends FormFieldProps<T, TOut> {
  min?: string;
  max?: string;
}

export const DateField = <T extends FieldValues, TOut extends FieldValues = T>({
  control, name, label, description, min, max,
}: DateFieldProps<T, TOut>) => {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell id={id} label={label} description={description} error={fieldState.error}>
          <Input
            {...field}
            value={field.value ?? ''}
            id={id}
            type="date"
            min={min}
            max={max}
            aria-invalid={fieldState.invalid}
            aria-describedby={describedBy(id, fieldState.invalid, !!description)}
          />
        </FieldShell>
      )}
    />
  );
};