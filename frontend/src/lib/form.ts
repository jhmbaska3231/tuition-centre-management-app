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

// a text input the api treats as absent when empty: the form holds "", the api receives
// null. the rule for a non empty value comes from the shared package, so the form never
// restates a length or format the api already defines
export const fromText = (rule: z.ZodType<string, string>) =>
  z.string().transform(value => (value.trim() === '' ? null : value)).pipe(rule.nullable());

// a select over a fixed set of values that must be chosen. like requiredchoice, the form
// can hold null while nothing is picked, and the output is always one of the values
export const requiredEnum = <const T extends readonly [string, ...string[]]>(values: T, message: string) =>
  z.enum(values).nullable().pipe(z.enum(values, { error: message }));