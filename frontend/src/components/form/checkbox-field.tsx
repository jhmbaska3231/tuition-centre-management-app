// frontend/src/components/form/checkbox-field.tsx
//
// a checkbox beside its label. base ui reports changes through oncheckedchange with a
// boolean, not through a change event, so the controller is wired by hand

import { useId } from 'react';
import { Controller, type FieldValues } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { describedBy } from '@/lib/form';
import type { FormFieldProps } from './field-shell';

interface CheckboxFieldProps<T extends FieldValues, TOut extends FieldValues> extends FormFieldProps<T, TOut> {
  disabled?: boolean;
}

export const CheckboxField = <T extends FieldValues, TOut extends FieldValues = T>({
  control, name, label, description, disabled,
}: CheckboxFieldProps<T, TOut>) => {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field orientation="horizontal" data-invalid={fieldState.invalid}>
          <Checkbox
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
          <FieldContent>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {description && !fieldState.invalid && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}
            {fieldState.invalid && <FieldError id={`${id}-error`} errors={[fieldState.error]} />}
          </FieldContent>
        </Field>
      )}
    />
  );
};