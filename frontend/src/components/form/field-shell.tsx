// frontend/src/components/form/field-shell.tsx
//
// the label, description and error frame shared by every stacked form field, so they all
// render identically and only the control in the middle differs

import type { ReactNode } from 'react';
import type { Control, FieldError as FormError, FieldPath, FieldValues } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';

// the props every field takes. tout is the schema's output type, which differs from the
// form's input type whenever a schema transforms, money text to cents for example
export interface FormFieldProps<T extends FieldValues, TOut extends FieldValues> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: string;
  description?: string;
}

interface FieldShellProps {
  id: string;
  label: string;
  description?: string;
  error?: FormError;
  children: ReactNode;
}

// the error replaces the description rather than sitting beside it, so a field never
// carries two lines of helper text at once
export const FieldShell = ({ id, label, description, error, children }: FieldShellProps) => (
  <Field data-invalid={!!error}>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    {children}
    {description && !error && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}
    {error && <FieldError id={`${id}-error`} errors={[error]} />}
  </Field>
);