// frontend/src/api/queries/students.ts

import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  AddGuardianInput, Student, UpdateGuardianInput, UpdateStudentInput,
} from '@tuition/shared';
import { api } from '../client';
import { keys } from '../keys';
import { invalidate } from '../query-client';
import type { z } from 'zod';
import type { createOwnStudentSchema } from '@tuition/shared';

// what the client sends: the schema's input, where fields with defaults are optional.
// z.infer would give the output, which requires them because the server fills them in
export type CreateOwnStudentBody = z.input<typeof createOwnStudentSchema>;

// the signed in parent's own children
export const useMyStudents = () =>
  useQuery({
    queryKey: keys.students.mine(),
    queryFn: () => api.get<Student[]>('/students/mine'),
  });

export const useStudent = (id: string) =>
  useQuery({ queryKey: keys.students.detail(id), queryFn: () => api.get<Student>(`/students/${id}`) });

// the caller becomes guardian and billing contact
export const useCreateOwnStudent = () =>
  useMutation({
    mutationFn: (input: CreateOwnStudentBody) => api.post<Student>('/students/mine', input),
    onSuccess: () => invalidate([keys.students.all]),
  });

// courses too: the course list is fetched per child's level, so a level change makes a
// cached list for that child wrong
export const useUpdateStudent = (id: string) =>
  useMutation({
    mutationFn: (input: UpdateStudentInput) => api.patch<Student>(`/students/${id}`, input),
    onSuccess: () => invalidate([keys.students.all, keys.courses.all]),
  });

export const useArchiveStudent = (id: string) =>
  useMutation({
    mutationFn: () => api.post<Student>(`/students/${id}/archive`),
    onSuccess: () => invalidate([keys.students.all, keys.enrollments.all]),
  });

export const useAddGuardian = (studentId: string) =>
  useMutation({
    mutationFn: (input: AddGuardianInput) => api.post<Student>(`/students/${studentId}/guardians`, input),
    onSuccess: () => invalidate([keys.students.all, keys.parents.all]),
  });

export const useUpdateGuardian = (studentId: string) =>
  useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: UpdateGuardianInput }) =>
      api.patch<Student>(`/students/${studentId}/guardians/${userId}`, input),
    onSuccess: () => invalidate([keys.students.all, keys.parents.all]),
  });

export const useRemoveGuardian = (studentId: string) =>
  useMutation({
    mutationFn: (userId: string) => api.delete<Student>(`/students/${studentId}/guardians/${userId}`),
    onSuccess: () => invalidate([keys.students.all, keys.parents.all]),
  });