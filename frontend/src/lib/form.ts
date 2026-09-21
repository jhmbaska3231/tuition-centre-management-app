// frontend/src/lib/form.ts

import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { isApiError } from '@/api/errors';

// maps a backend validation_error onto the matching form fields. returns true when at
// least one field was set, so the caller shows a form level message only otherwise
export const applyServerErrors = <T extends FieldValues>(setError: UseFormSetError<T>, err: unknown): boolean => {
  if (!isApiError(err)) return false;
  const fields = err.fieldErrors;
  const names = Object.keys(fields);
  for (const name of names) setError(name as Path<T>, { type: 'server', message: fields[name] });
  return names.length > 0;
};