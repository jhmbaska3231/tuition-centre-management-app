// frontend/src/api/queries/enrollment.ts

import { useQuery } from '@tanstack/react-query';
import type { MakeupCredit, MakeupStatus, WaitlistEntry, Enrollment, EnrollmentStatus } from '@tuition/shared';
import { api } from '../client';
import { keys } from '../keys';

// open entries only, waiting and offered. for a parent, only their own children's
export const useWaitlist = () =>
  useQuery({
    queryKey: keys.waitlist.list(),
    queryFn: () => api.get<WaitlistEntry[]>('/waitlist'),
  });

export type MakeupFilters = {
  status?: MakeupStatus;
};

export const useMakeups = (filters: MakeupFilters = {}) =>
  useQuery({
    queryKey: keys.makeups.list(filters),
    queryFn: () => api.get<MakeupCredit[]>('/makeups', filters),
  });

export type EnrollmentFilters = {
  studentId?: string;
  status?: EnrollmentStatus;
};

export const useEnrollments = (filters: EnrollmentFilters = {}) =>
  useQuery({
    queryKey: keys.enrollments.list(filters),
    queryFn: () => api.get<Enrollment[]>('/enrollments', filters),
  });