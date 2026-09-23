// frontend/src/components/form/select-field.tsx

import { useId } from 'react';
import { Controller, type FieldValues } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { describedBy } from '@/lib/form';
import { FieldShell, type FormFieldProps } from './field-shell';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps<T extends FieldValues, TOut extends FieldValues> extends FormFieldProps<T, TOut> {
  options: SelectOption[];
  placeholder?: string;
  // when set, the field can be cleared back to null through an option with this label
  noneLabel?: string;
  disabled?: boolean;
}

export const SelectField = <T extends FieldValues, TOut extends FieldValues = T>({
  control, name, label, description, options, placeholder = 'Select', noneLabel, disabled,
}: SelectFieldProps<T, TOut>) => {
  const id = useId();
  // base ui shows the raw value in the trigger unless the root knows every value's label.
  // the null entry is what an empty field displays: the none label when the field can be
  // cleared, otherwise the placeholder
  const items = [{ value: null, label: noneLabel ?? placeholder }, ...options];

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell id={id} label={label} description={description} error={fieldState.error}>
          <Select
            items={items}
            value={field.value ?? null}
            onValueChange={value => field.onChange(value)}
            // touched when the list closes, not when focus first moves into it
            onOpenChange={open => { if (!open) field.onBlur(); }}
            disabled={disabled}
          >
            <SelectTrigger
              ref={field.ref}
              id={id}
              className="w-full"
              aria-invalid={fieldState.invalid}
              aria-describedby={describedBy(id, fieldState.invalid, !!description)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {noneLabel && <SelectItem value={null}>{noneLabel}</SelectItem>}
              {options.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldShell>
      )}
    />
  );
};