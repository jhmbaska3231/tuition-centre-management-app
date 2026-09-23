// frontend/src/lib/form.ts

import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { isApiError } from '@/api/errors';
import { z } from 'zod';

// maps a backend validation_error onto the matching form fields. returns true when at
// least one field was set, so the caller shows a form level message only otherwise
export const applyServerErrors = <T extends FieldValues>(setError: UseFormSetError<T>, err: unknown): boolean => {
  if (!isApiError(err)) return false;
  const fields = err.fieldErrors;
  const names = Object.keys(fields);
  for (const name of names) setError(name as Path<T>, { type: 'server', message: fields[name] });
  return names.length > 0;
};

// points assistive technology at the text under a field: the error when there is one,
// otherwise the description. the ids match what fieldshell renders
export const describedBy = (id: string, invalid: boolean, hasDescription: boolean): string | undefined =>
  invalid ? `${id}-error` : hasDescription ? `${id}-description` : undefined;

// a select that must be chosen starts as null, since nothing is picked yet. this accepts
// null as input so the form can hold it, then refuses it with a readable message, and
// the output type is a plain string so the submit handler never sees null
export const requiredChoice = (message: string) =>
  z.string().nullable().pipe(z.string({ error: message }));