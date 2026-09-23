// frontend/src/api/queries/students.ts

import { useQuery } from '@tanstack/react-query';
import type { Student } from '@tuition/shared';
import { api } from '../client';
import { keys } from '../keys';

// the signed in parent's own children
export const useMyStudents = () =>
  useQuery({
    queryKey: keys.students.mine(),
    queryFn: () => api.get<Student[]>('/students/mine'),
  });