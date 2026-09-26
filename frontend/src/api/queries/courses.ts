// frontend/src/api/queries/courses.ts

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Course } from '@tuition/shared';
import { api } from '../client';
import { keys } from '../keys';

// for a parent, studentid narrows the list to open courses at that child's level plus
// mixed level ones. a type alias, not an interface, so it fits the client's query params
export type CourseFilters = {
  studentId?: string;
  branchId?: string;
  subjectId?: string;
};

// enabled lets the caller hold the request until the filters are known: a parent's list
// without a child would mix every child's levels together. keeping the previous data means
// changing a child or filter leaves the old list on screen until the new one arrives,
// rather than flashing back to a skeleton
export const useCourses = (filters: CourseFilters, { enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: keys.courses.list(filters),
    queryFn: () => api.get<Course[]>('/courses', filters),
    enabled,
    placeholderData: keepPreviousData,
  });

export const useCourse = (id: string) =>
  useQuery({
    queryKey: keys.courses.detail(id),
    queryFn: () => api.get<Course>(`/courses/${id}`),
  });