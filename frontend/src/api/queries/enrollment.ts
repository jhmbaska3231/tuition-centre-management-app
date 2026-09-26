// frontend/src/api/queries/enrollment.ts

import { useMutation, useQuery } from '@tanstack/react-query';
import type { MakeupCredit, MakeupStatus, Enrollment, EnrollmentStatus, enrollSchema, joinWaitlistSchema, WaitlistEntry } from '@tuition/shared';
import { api } from '../client';
import { keys } from '../keys';
import type { z } from 'zod';
import { isApiError } from '../errors';
import { invalidate } from '../query-client';

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

// the schemas' inputs: startsOn is optional, and staff only
export type EnrollBody = z.input<typeof enrollSchema>;
export type JoinWaitlistBody = z.input<typeof joinWaitlistSchema>;

// a new enrollment changes the child's classes, their sessions, the course's seats, and the
// dashboard counts. a refusal usually means the page's seat count was out of date, so the
// course list is refreshed then too, and the card behind the dialog updates to match
export const useEnroll = () =>
  useMutation({
    mutationFn: (input: EnrollBody) => api.post<Enrollment>('/enrollments', input),
    onSuccess: () => invalidate([keys.enrollments.all, keys.courses.all, keys.students.all, keys.sessions.all, keys.reports.all]),
    onError: error => {
      if (isApiError(error) && error.code === 'rule_violation') void invalidate([keys.courses.all]);
    },
  });

// joining changes the queue and the course's seats left
export const useJoinWaitlist = () =>
  useMutation({
    mutationFn: (input: JoinWaitlistBody) => api.post<WaitlistEntry>('/waitlist', input),
    onSuccess: () => invalidate([keys.waitlist.all, keys.courses.all]),
  });