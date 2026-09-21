// frontend/src/lib/utils.ts

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// merges tailwind classes so a later class wins over an earlier conflicting one
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));