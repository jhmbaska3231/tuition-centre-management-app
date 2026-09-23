// frontend/src/components/form/textarea-field.tsx

import { useId } from 'react';
import { Controller, type FieldValues } from 'react-hook-form';
import { Textarea } from '@/components/ui/textarea';
import { describedBy } from '@/lib/form';
import { FieldShell, type FormFieldProps } from './field-shell';

interface TextareaFieldProps<T extends FieldValues, TOut extends FieldValues> extends FormFieldProps<T, TOut> {
  placeholder?: string;
  // match the schema's max so the user is stopped while typing rather than refused on submit
  maxLength?: number;
}

export const TextareaField = <T extends FieldValues, TOut extends FieldValues = T>({
  control, name, label, description, placeholder, maxLength,
}: TextareaFieldProps<T, TOut>) => {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell id={id} label={label} description={description} error={fieldState.error}>
          <Textarea
            {...field}
            value={field.value ?? ''}
            id={id}
            placeholder={placeholder}
            maxLength={maxLength}
            aria-invalid={fieldState.invalid}
            aria-describedby={describedBy(id, fieldState.invalid, !!description)}
          />
        </FieldShell>
      )}
    />
  );
};