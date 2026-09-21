// frontend/src/components/form/text-field.tsx
//
// one labelled input wired to react-hook-form. the label, description and error
// rendering come from the shadcn field component so every form looks the same

import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface TextFieldProps<T extends FieldValues, TOut extends FieldValues> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: string;
  type?: 'text' | 'email' | 'password' | 'tel';
  autoComplete?: string;
  placeholder?: string;
  description?: string;
}

export const TextField = <T extends FieldValues, TOut extends FieldValues = T>({
  control, name, label, type = 'text', autoComplete, placeholder, description,
}: TextFieldProps<T, TOut>) => (
  <Controller
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
        <Input
          {...field}
          value={field.value ?? ''}
          id={name}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={fieldState.invalid}
        />
        {description && !fieldState.invalid && <FieldDescription>{description}</FieldDescription>}
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
);