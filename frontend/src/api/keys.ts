// frontend/src/api/keys.ts
//
// every query key in one place. hierarchical so a mutation can invalidate a whole
// branch: invalidatequeries({ querykey: keys.courses.all }) catches every course list
// and detail regardless of filters

export const keys = {
  org: {
    all: ['org'] as const,
    detail: () => [...keys.org.all, 'detail'] as const,
    notificationEvents: () => [...keys.org.all, 'notification-events'] as const,
    integrations: () => [...keys.org.all, 'integrations'] as const,
  },
  auth: {
    me: ['auth', 'me'] as const,
  },
  reference: {
    levels: ['levels'] as const,
    subjects: ['subjects'] as const,
    branches: ['branches'] as const,
    classrooms: (branchId: string) => ['branches', branchId, 'classrooms'] as const,
    closures: (filters?: unknown) => ['closures', filters ?? {}] as const,
    terms: ['terms'] as const,
    feePlans: ['fee-plans'] as const,
  },
  staff: {
    all: ['staff'] as const,
    list: (filters?: unknown) => [...keys.staff.all, 'list', filters ?? {}] as const,
    detail: (id: string) => [...keys.staff.all, 'detail', id] as const,
  },
  parents: {
    all: ['parents'] as const,
    list: (filters?: unknown) => [...keys.parents.all, 'list', filters ?? {}] as const,
    detail: (id: string) => [...keys.parents.all, 'detail', id] as const,
  },
  students: {
    all: ['students'] as const,
    list: (filters?: unknown) => [...keys.students.all, 'list', filters ?? {}] as const,
    mine: () => [...keys.students.all, 'mine'] as const,
    detail: (id: string) => [...keys.students.all, 'detail', id] as const,
  },
  courses: {
    all: ['courses'] as const,
    list: (filters?: unknown) => [...keys.courses.all, 'list', filters ?? {}] as const,
    detail: (id: string) => [...keys.courses.all, 'detail', id] as const,
  },
  sessions: {
    all: ['sessions'] as const,
    list: (filters?: unknown) => [...keys.sessions.all, 'list', filters ?? {}] as const,
    detail: (id: string) => [...keys.sessions.all, 'detail', id] as const,
    needingCover: () => [...keys.sessions.all, 'needing-cover'] as const,
    roster: (sessionId: string) => [...keys.sessions.all, 'roster', sessionId] as const,
  },
  enrollments: {
    all: ['enrollments'] as const,
    list: (filters?: unknown) => [...keys.enrollments.all, 'list', filters ?? {}] as const,
    detail: (id: string) => [...keys.enrollments.all, 'detail', id] as const,
    attendance: (id: string) => [...keys.enrollments.all, 'attendance', id] as const,
  },
  waitlist: {
    all: ['waitlist'] as const,
    list: (filters?: unknown) => [...keys.waitlist.all, 'list', filters ?? {}] as const,
  },
  makeups: {
    all: ['makeups'] as const,
    list: (filters?: unknown) => [...keys.makeups.all, 'list', filters ?? {}] as const,
    options: (id: string) => [...keys.makeups.all, 'options', id] as const,
  },
  leave: {
    all: ['leave'] as const,
    list: (filters?: unknown) => [...keys.leave.all, 'list', filters ?? {}] as const,
  },
  availability: {
    detail: (tutorId: string) => ['availability', tutorId] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    list: (filters?: unknown) => [...keys.invoices.all, 'list', filters ?? {}] as const,
    detail: (id: string) => [...keys.invoices.all, 'detail', id] as const,
    myBalance: () => [...keys.invoices.all, 'my-balance'] as const,
  },
  payments: {
    all: ['payments'] as const,
    list: (filters?: unknown) => [...keys.payments.all, 'list', filters ?? {}] as const,
    detail: (id: string) => [...keys.payments.all, 'detail', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    preferences: () => [...keys.notifications.all, 'preferences'] as const,
    outbox: (filters?: unknown) => [...keys.notifications.all, 'outbox', filters ?? {}] as const,
  },
  reports: {
    all: ['reports'] as const,
    overview: () => [...keys.reports.all, 'overview'] as const,
    courseFill: () => [...keys.reports.all, 'course-fill'] as const,
    enrollmentBreakdown: () => [...keys.reports.all, 'enrollment-breakdown'] as const,
    revenue: (range?: unknown) => [...keys.reports.all, 'revenue', range ?? {}] as const,
    attendance: (range?: unknown) => [...keys.reports.all, 'attendance', range ?? {}] as const,
    tutorWorkload: (range?: unknown) => [...keys.reports.all, 'tutor-workload', range ?? {}] as const,
    churn: (range?: unknown) => [...keys.reports.all, 'churn', range ?? {}] as const,
  },
  audit: {
    all: ['audit'] as const,
    list: (filters?: unknown) => [...keys.audit.all, 'list', filters ?? {}] as const,
  },
} as const;