# tuition centre management system

a multi branch tuition centre platform built for singapore centres. one deployment serves
one centre, with its own branding, settings, fee structure and data

> status: backend complete and verified end to end, frontend in progress

---

## what it does

**for parents**
- browse classes filtered to their child's level, enroll in seconds, join a waitlist when a
  class is full and get offered the seat automatically when one opens
- see every upcoming session, and a full history of attendance with the tutor's notes
- get told when a session is cancelled, a tutor changes, or their child is marked absent
- view invoices, outstanding balance and payment history in one place
- book a make up session when their child misses a class

**for tutors**
- one screen per session: the roster, marked in a few taps at the classroom door
- lesson notes and homework attached to the session, visible to parents
- submit leave from the app and set weekly availability so admins do not double book them

**for admins**
- define a class once with its weekly slots, and sessions are generated automatically
  for the term, skipping public holidays and centre closures
- approve tutor leave and see immediately which sessions need cover, with double booking
  prevented at the database level
- invoices generated automatically each month or term, pro rated for mid term joiners,
  with sibling discounts and gst
- record payments, allocate them across invoices, issue credit notes, chase overdue fees
- reporting on class fill rates, revenue, attendance, tutor workload and student churn
- multiple branches, with branch managers scoped to the branches they run

**for the centre owner**
- every change is recorded in an audit log: who cancelled an enrollment, who waived a fee,
  who edited attendance after the fact
- email delivery configured by the admin, with per event toggles and per parent preferences

---

## engineering approach

the decisions worth knowing about and why

**classes are definitions, sessions are instances.** a course carries its weekly slots and
a term. a background job turns that definition into real dated sessions, always keeping the
next few weeks generated ahead of time, so schedules never run dry. this is what makes make
ups, cover teachers, per session room changes, holiday cancellations and pro rated billing
possible, all of which are awkward or impossible when a "class" is a single row with one date
on it

**conflicts are prevented by the database, not by application checks.** postgresql
exclusion constraints on the sessions table make it impossible to double book a tutor or a
classroom, even under concurrent writes. two admins booking the same room at the same
instant cannot both succeed

**attendance is marked against a derived roster.** who belongs in a session is worked out
fresh each time from current enrollments and make up bookings, never from a stored list.
that means the client cannot tamper with it, and a mid term withdrawal takes effect
immediately with no cleanup needed.

**money is handled like accounting, not like a simple database record.** an invoice is
immutable once issued. corrections are credit notes or a void and reissue. payments are
separate records allocated to invoices explicitly, so one bank transfer covering two children,
a partial payment, or an overpayment carried forward all work without special cases. amounts
are integer cents throughout

**notifications use a transactional outbox.** the email row is written in the same database
transaction as the change that triggered it, then delivered by a worker. a rolled back
cancellation can never send a "your class is cancelled" email, and a provider outage causes
retries rather than lost messages

**every job is idempotent.** the nightly run can be executed twice, or by hand after an
outage, and creates nothing extra. partial unique indexes enforce this at the database
level rather than relying on the job's own bookkeeping

**timezone correctness is designed in.** every timestamp is `timestamptz` stored in utc,
every calendar date is a `date`, and conversion happens using the centre's configured timezone.
a server in another region produces identical results

---

## architecture

- **backend**: node 22, express 5, typescript, postgresql 18, parameterised sql via `pg`.
  modular monolith: each domain module has routes, zod schemas, a service that owns
  transactions and business rules, and a repository that contains only sql
- **worker**: the same image run as a separate process. pg-boss, a job queue that runs
  inside postgres, schedules the nightly job, hourly session reminders and the notification
  dispatcher. no extra infrastructure to operate
- **frontend**: react 19, vite, tailwind
- **auth**: short lived hs256 access token held in memory, rotating refresh token in an
  `httponly` cookie backed by server side sessions with reuse detection
- **deployment**: two containers from one image, kubernetes, postgres with point in time
  recovery. schema is applied by migration, never by the application at runtime

```
backend/src/
  config/     env validation, typed config
  db/         pool, query helpers, transactions, pg error translation
  http/       app factory, middleware, error contract
  modules/    auth  org  users  students  scheduling  enrollment
              billing  notifications  audit  reports
  jobs/       nightly job, runnable standalone
  worker.ts   pg-boss scheduler
```

the full schema including every constraint is in `backend/db/schema/0001_baseline.sql`

---

## security

- parameterised sql throughout, no string built queries
- bcrypt at cost factor 12, with a dummy comparison on unknown emails so login timing
  does not reveal which addresses have accounts
- refresh tokens are random bytes stored only as sha256 hashes, rotated on every use, with
  reuse detection that revokes the entire session family
- deactivating a user invalidates their sessions on their next request, not when their
  token happens to expire
- rate limiting across the api, with a tighter limit on credential endpoints
- provider credentials encrypted at rest with aes-256-gcm and never returned decrypted
- role based authorisation with branch scoping, enforced in one place per module
- every state change writes an audit row in the same transaction as the change
- environment configuration is validated at boot, and production refuses to start with an
  insecure cookie flag, an unencrypted database connection, or a non https origin

---

## api

all routes under `/api`. errors are always
`{ error: { code, message, details?, requestId } }`, with the request id also returned as a
header so a support report can be traced to the exact log line

| area          | routes |
|---------------|--------|
| auth          | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/me`, `/auth/password-reset/{request,confirm}` |
| account       | `/account/profile`, `/account/password`, `/account` |
| org           | `/org`, `/org/settings`, `/org/notification-events`, `/org/integrations` |
| reference     | `/branches`, `/classrooms`, `/closures`, `/levels`, `/subjects`, `/terms`, `/fee-plans` |
| people        | `/staff`, `/parents`, `/students`, `/students/mine`, `/students/:id/guardians` |
| scheduling    | `/courses`, `/courses/:id/{slots,status,generate}`, `/sessions`, `/sessions/needing-cover`, `/sessions/:id/{cancel,cover,notes}`, `/tutors/:id/availability`, `/leave` |
| enrollment    | `/enrollments`, `/enrollments/:id/{withdraw,attendance}`, `/waitlist`, `/attendance/sessions/:id`, `/makeups` |
| billing       | `/invoices`, `/invoices/my-balance`, `/invoices/:id/{void,credit-notes}`, `/payments`, `/payments/:id/refund`, `/billing/webhooks/:provider` |
| notifications | `/notifications/preferences`, `/notifications/test-email`, `/notifications/outbox` |
| reporting     | `/reports/{overview,course-fill,enrollment-breakdown,revenue,attendance,tutor-workload,churn}`, `/audit` |
| ops           | `/health`, `/ready`, `/metrics` |

**background jobs**

| job                      | schedule     | what it does |
|--------------------------|--------------|--------------|
| `nightly`                | 02:30 local  | complete finished sessions, extend next batch of upcoming sessions, settle ended enrollments, expire waitlist offers and make up credits, offer freed seats, issue invoices, queue overdue reminders |
| `session-reminders`      | hourly       | remind guardians of sessions starting in 24 hours |
| `dispatch-notifications` | every minute | send queued email, retry with backoff, scrub payloads after sending |

---

## running it locally

prerequisites: node 22.12+, postgresql 18, a database role with `createdb`

```bash
cd backend
cp .env.example .env  # database credentials and two generated secrets
npm install
npm run db:reset      # schema and a full demo centre
npm run dev           # api on :8080
npm run worker:dev    # jobs and email dispatch
```

the seed builds a working centre: two branches, eight courses, a term of generated sessions
with attendance already marked, invoices in several payment states, a waitlisted student
and a pending leave request. dates are relative to today, so a reset always produces
current data. every seeded account uses the password `password123`, and the reset prints
the list

`backend/smoke.http` is a request collection covering registration, enrollment, attendance,
make up credits, payment allocation, leave approval and cover assignment. open it with the
[rest client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
extension and send the requests in order