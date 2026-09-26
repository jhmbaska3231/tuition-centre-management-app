// frontend/src/features/parent/classes/course-state.ts
//
// where the selected child stands with one course, decided from data already on the page, so
// the card and the detail page never offer an action the api would refuse

import type { Course, Enrollment, WaitlistEntry } from '@tuition/shared';

export type CourseState =
  | { kind: 'enrolled'; enrollmentId: string }
  | { kind: 'offered' }
  | { kind: 'waiting' }
  | { kind: 'open'; seatsLeft: number }
  | { kind: 'full' };

// checked in this order: an enrollment outranks a waitlist entry, and either outranks the seat
// count, since a child already in or already queued cannot enroll again
export const courseState = (
  course: Course,
  studentId: string,
  enrollments: Enrollment[],
  waitlist: WaitlistEntry[],
): CourseState => {
  const enrollment = enrollments.find(e => e.course_id === course.id && e.student_id === studentId);
  if (enrollment) return { kind: 'enrolled', enrollmentId: enrollment.id };

  const entry = waitlist.find(w => w.course_id === course.id && w.student_id === studentId);
  if (entry) return entry.status === 'offered' ? { kind: 'offered' } : { kind: 'waiting' };

  return course.seats_left > 0 ? { kind: 'open', seatsLeft: course.seats_left } : { kind: 'full' };
};