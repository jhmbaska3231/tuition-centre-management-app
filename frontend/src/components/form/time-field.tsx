// frontend/src/components/form/time-field.tsx
//
// a native time input. a step of 60 seconds keeps the value at hh:mm with no seconds,
// matching the shared time of day format

import { useId } from 'react';
import { Controller, type FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { describedBy } from '@/lib/form';
import { FieldShell, type FormFieldProps } from './field-shell';

export const TimeField = <T extends FieldValues, TOut extends FieldValues = T>({
  control, name, label, description,
}: FormFieldProps<T, TOut>) => {
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
            type="time"
            step={60}
            aria-invalid={fieldState.invalid}
            aria-describedby={describedBy(id, fieldState.invalid, !!description)}
          />
        </FieldShell>
      )}
    />
  );
};