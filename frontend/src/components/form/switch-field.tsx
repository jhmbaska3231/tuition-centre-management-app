// frontend/src/components/form/switch-field.tsx
//
// a settings row: label and description on the left, the switch on the right

import { useId } from 'react';
import { Controller, type FieldValues } from 'react-hook-form';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { describedBy } from '@/lib/form';
import type { FormFieldProps } from './field-shell';

interface SwitchFieldProps<T extends FieldValues, TOut extends FieldValues> extends FormFieldProps<T, TOut> {
  disabled?: boolean;
}

export const SwitchField = <T extends FieldValues, TOut extends FieldValues = T>({
  control, name, label, description, disabled,
}: SwitchFieldProps<T, TOut>) => {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field orientation="horizontal" data-invalid={fieldState.invalid}>
          <FieldContent>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {description && !fieldState.invalid && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}
            {fieldState.invalid && <FieldError id={`${id}-error`} errors={[fieldState.error]} />}
          </FieldContent>
          <Switch
            ref={field.ref}
            id={id}
            name={field.name}
            checked={field.value ?? false}
            onCheckedChange={checked => field.onChange(checked)}
            onBlur={field.onBlur}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
            aria-describedby={describedBy(id, fieldState.invalid, !!description)}
          />
        </Field>
      )}
    />
  );
};