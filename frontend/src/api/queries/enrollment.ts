// frontend/src/api/queries/enrollment.ts

import { useMutation, useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import type {
  AttendanceHistoryEntry, bookMakeupSchema, Enrollment, EnrollmentDetail, EnrollmentStatus, enrollSchema,
  joinWaitlistSchema, MakeupCredit, MakeupStatus, MakeupOption, MakeupPolicy, WaitlistEntry, withdrawSchema,
} from '@tuition/shared';
import { api } from '../client';
import { isApiError } from '../errors';
import { keys } from '../keys';
import { invalidate } from '../query-client';

export type EnrollmentFilters = {
  studentId?: string;
  status?: EnrollmentStatus;
};

export type MakeupFilters = {
  status?: MakeupStatus;
};

// the schemas' inputs: startson is optional, and staff only
export type EnrollBody = z.input<typeof enrollSchema>;
export type JoinWaitlistBody = z.input<typeof joinWaitlistSchema>;
export type WithdrawBody = z.input<typeof withdrawSchema>;
export type BookMakeupBody = z.input<typeof bookMakeupSchema>;

export const useEnrollments = (filters: EnrollmentFilters = {}) =>
  useQuery({
    queryKey: keys.enrollments.list(filters),
    queryFn: () => api.get<Enrollment[]>('/enrollments', filters),
  });

export const useEnrollment = (id: string) =>
  useQuery({
    queryKey: keys.enrollments.detail(id),
    queryFn: () => api.get<EnrollmentDetail>(`/enrollments/${id}`),
  });

export const useAttendanceHistory = (enrollmentId: string) =>
  useQuery({
    queryKey: keys.enrollments.attendance(enrollmentId),
    queryFn: () => api.get<AttendanceHistoryEntry[]>(`/enrollments/${enrollmentId}/attendance`),
  });

// open entries only, waiting and offered. for a parent, only their own children's
export const useWaitlist = () =>
  useQuery({
    queryKey: keys.waitlist.list(),
    queryFn: () => api.get<WaitlistEntry[]>('/waitlist'),
  });

export const useMakeups = (filters: MakeupFilters = {}) =>
  useQuery({
    queryKey: keys.makeups.list(filters),
    queryFn: () => api.get<MakeupCredit[]>('/makeups', filters),
  });

// the centre's make up rules. they change only when an admin edits the settings, so they are
// kept fresh longer than screen data
export const useMakeupPolicy = () =>
  useQuery({
    queryKey: keys.makeups.policy(),
    queryFn: () => api.get<MakeupPolicy>('/makeups/policy'),
    staleTime: 5 * 60_000,
  });

// the classes one credit could be booked into, fetched only while they are on screen. a refusal
// here is usually the term cap, which the screen shows as an explanation rather than an error
export const useMakeupOptions = (creditId: string, { enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: keys.makeups.options(creditId),
    queryFn: () => api.get<MakeupOption[]>(`/makeups/${creditId}/options`),
    enabled,
  });

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

// a withdrawal changes the child's classes, their future sessions, the course's seats, and can
// free a seat that is then offered to the waitlist
export const useWithdraw = (enrollmentId: string) =>
  useMutation({
    mutationFn: (input: { reason?: string }) => api.post<Enrollment>(`/enrollments/${enrollmentId}/withdraw`, input),
    onSuccess: () => invalidate([
      keys.enrollments.all, keys.courses.all, keys.students.all, keys.sessions.all, keys.waitlist.all, keys.reports.all,
    ]),
  });

// joining changes the queue and the course's seats left. a refusal means the page's seat
// count was out of date, so the course list is refreshed then too
export const useJoinWaitlist = () =>
  useMutation({
    mutationFn: (input: JoinWaitlistBody) => api.post<WaitlistEntry>('/waitlist', input),
    onSuccess: () => invalidate([keys.waitlist.all, keys.courses.all]),
    onError: error => {
      if (isApiError(error) && error.code === 'rule_violation') void invalidate([keys.courses.all]);
    },
  });

// booking puts the child on another class's roster, which shows in their session list. a
// refusal means the options were out of date, so they are refreshed
export const useBookMakeup = (creditId: string) =>
  useMutation({
    mutationFn: (input: BookMakeupBody) => api.post<MakeupCredit>(`/makeups/${creditId}/book`, input),
    onSuccess: () => invalidate([keys.makeups.all, keys.sessions.all]),
    onError: error => {
      if (isApiError(error) && error.code === 'rule_violation') void invalidate([keys.makeups.options(creditId)]);
    },
  });

export const useUnbookMakeup = () =>
  useMutation({
    mutationFn: (creditId: string) => api.post<MakeupCredit>(`/makeups/${creditId}/unbook`),
    onSuccess: () => invalidate([keys.makeups.all, keys.sessions.all]),
  });

// accepting creates an enrollment, so it changes everything enrolling does, and the queue. a
// refusal means the offer expired or the seat went, so the list is refreshed to match
export const useAcceptOffer = () =>
  useMutation({
    mutationFn: (entryId: string) => api.post<Enrollment>(`/waitlist/${entryId}/accept`),
    onSuccess: () => invalidate([
      keys.enrollments.all, keys.courses.all, keys.students.all, keys.sessions.all, keys.waitlist.all, keys.reports.all,
    ]),
    onError: error => {
      if (isApiError(error) && error.code === 'rule_violation') void invalidate([keys.waitlist.all, keys.courses.all]);
    },
  });

// leaving shortens the queue, which changes the course's seats left. leaving with an offer
// open passes the seat to the next family
export const useLeaveWaitlist = () =>
  useMutation({
    mutationFn: (entryId: string) => api.post<WaitlistEntry>(`/waitlist/${entryId}/withdraw`),
    onSuccess: () => invalidate([keys.waitlist.all, keys.courses.all]),
  });