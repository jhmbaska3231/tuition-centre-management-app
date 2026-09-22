-- 0001_baseline.sql
-- baseline schema, applied to an empty database by db/reset.ts in development
-- requires postgresql 18 (uuidv7), on older versions replace uuidv7() with gen_random_uuid()

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- tenancy and settings
-- ---------------------------------------------------------------------------
CREATE TABLE organisations (
  id           UUID PRIMARY KEY DEFAULT uuidv7(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  timezone     TEXT NOT NULL DEFAULT 'Asia/Singapore',
  currency     CHAR(3) NOT NULL DEFAULT 'SGD',
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- typed settings, 1:1 with organisations, every rule the app enforces reads from here
CREATE TABLE organisation_settings (
  org_id                        UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  session_horizon_weeks         INTEGER NOT NULL DEFAULT 12 CHECK (session_horizon_weeks BETWEEN 1 AND 52),
  adhoc_min_lead_minutes        INTEGER NOT NULL DEFAULT 60 CHECK (adhoc_min_lead_minutes >= 0),
  adhoc_max_lead_days           INTEGER NOT NULL DEFAULT 31 CHECK (adhoc_max_lead_days > 0),
  travel_buffer_minutes         INTEGER NOT NULL DEFAULT 30 CHECK (travel_buffer_minutes >= 0),
  attendance_edit_window_days   INTEGER NOT NULL DEFAULT 7 CHECK (attendance_edit_window_days >= 0),
  waitlist_offer_hours          INTEGER NOT NULL DEFAULT 48 CHECK (waitlist_offer_hours > 0),
  makeup_eligible_statuses      TEXT[] NOT NULL DEFAULT ARRAY['excused'],
  makeup_expiry_policy          TEXT NOT NULL DEFAULT 'end_of_term'
                                CHECK (makeup_expiry_policy IN ('end_of_term', 'fixed_days')),
  makeup_expiry_days            INTEGER NOT NULL DEFAULT 30 CHECK (makeup_expiry_days > 0),
  makeup_min_lead_minutes       INTEGER NOT NULL DEFAULT 1440 CHECK (makeup_min_lead_minutes >= 0),
  makeup_cap_per_term           INTEGER DEFAULT 2 CHECK (makeup_cap_per_term > 0),
  billing_generation_day        SMALLINT NOT NULL DEFAULT 25 CHECK (billing_generation_day BETWEEN 1 AND 28),
  billing_due_day               SMALLINT NOT NULL DEFAULT 7 CHECK (billing_due_day BETWEEN 1 AND 28),
  tax_rate_bp                   INTEGER NOT NULL DEFAULT 0 CHECK (tax_rate_bp BETWEEN 0 AND 10000),
  sibling_discount_bp           INTEGER NOT NULL DEFAULT 0 CHECK (sibling_discount_bp BETWEEN 0 AND 10000),
  invoice_prefix                TEXT NOT NULL DEFAULT 'INV',
  -- how parents pay while there is no gateway: paynow uen, bank account, cheque payee.
  -- read live rather than snapshotted onto invoices, so changing bank details updates
  -- every unpaid invoice instead of sending parents to a closed account
  payment_instructions          TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- provider credentials set by the centre admin, config_encrypted is aes-256-gcm
-- (iv || tag || ciphertext) produced in the application with app_encryption_key
CREATE TABLE org_integrations (
  id                UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('email', 'sms', 'whatsapp', 'payment')),
  provider          TEXT NOT NULL,
  config_encrypted  BYTEA NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, kind)
);

-- event keys used by notification_event_settings and notifications.event_key:
--   session_reminder, session_cancelled, tutor_changed, student_absent,
--   invoice_issued, invoice_overdue, waitlist_offer,
--   leave_request_submitted, leave_request_decided
CREATE TABLE notification_event_settings (
  id          UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  event_key   TEXT NOT NULL CHECK (event_key IN (
                'session_reminder', 'session_cancelled', 'session_rescheduled', 'tutor_changed', 'student_absent',
                'invoice_issued', 'invoice_overdue', 'waitlist_offer',
                'leave_request_submitted', 'leave_request_decided')),
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, event_key)
);

-- ---------------------------------------------------------------------------
-- identity
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id         UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('parent', 'tutor', 'branch_manager', 'admin')),
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  phone          TEXT,
  last_login_at  TIMESTAMPTZ,
  archived_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_org_email_uq ON users (org_id, lower(email));

ALTER TABLE org_integrations
  ADD CONSTRAINT org_integrations_updated_by_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- server side refresh sessions, one row per issued refresh token. rotation inserts a
-- new row with the same family_id and sets replaced_by_id on the old one. presenting
-- a token that already has replaced_by_id set means reuse: revoke the whole family
CREATE TABLE auth_sessions (
  id                  UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id           UUID NOT NULL,
  refresh_token_hash  TEXT NOT NULL UNIQUE,
  expires_at          TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ,
  replaced_by_id      UUID REFERENCES auth_sessions(id) ON DELETE SET NULL,
  ip                  INET,
  user_agent          TEXT,
  last_used_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_active_idx ON auth_sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX auth_sessions_family_idx ON auth_sessions (family_id);

CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- places
-- ---------------------------------------------------------------------------
CREATE TABLE branches (
  id           UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  address      TEXT NOT NULL,
  phone        TEXT,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

-- branch scoping for branch_manager (and optionally tutor), admins have no rows
CREATE TABLE user_branches (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, branch_id)
);

CREATE TABLE classrooms (
  id           UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  capacity     INTEGER NOT NULL CHECK (capacity > 0),
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, name)
);

-- public holidays and closures, branch_id null applies to the whole organisation
CREATE TABLE closures (
  id          UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  branch_id   UUID REFERENCES branches(id) ON DELETE CASCADE,
  starts_on   DATE NOT NULL,
  ends_on     DATE NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);
CREATE INDEX closures_org_dates_idx ON closures (org_id, starts_on, ends_on);

-- ---------------------------------------------------------------------------
-- reference data
-- ---------------------------------------------------------------------------
CREATE TABLE levels (
  id           UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE TABLE subjects (
  id           UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

-- ---------------------------------------------------------------------------
-- students and guardians
-- ---------------------------------------------------------------------------
CREATE TABLE students (
  id               UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  level_id         UUID REFERENCES levels(id) ON DELETE SET NULL,
  date_of_birth    DATE,
  school           TEXT,
  home_branch_id   UUID REFERENCES branches(id) ON DELETE SET NULL,
  notes            TEXT,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX students_org_active_idx ON students (org_id) WHERE archived_at IS NULL;
CREATE INDEX students_level_idx ON students (level_id);

CREATE TABLE student_guardians (
  student_id              UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship            TEXT NOT NULL CHECK (relationship IN ('mother', 'father', 'guardian')),
  is_billing_contact      BOOLEAN NOT NULL DEFAULT FALSE,
  receives_notifications  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, user_id)
);
CREATE UNIQUE INDEX student_guardians_one_billing_contact_uq
  ON student_guardians (student_id) WHERE is_billing_contact;
CREATE INDEX student_guardians_user_idx ON student_guardians (user_id);

-- ---------------------------------------------------------------------------
-- scheduling
-- ---------------------------------------------------------------------------
CREATE TABLE terms (
  id           UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  starts_on    DATE NOT NULL,
  ends_on      DATE NOT NULL,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE fee_plans (
  id             UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id         UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  amount_cents   BIGINT NOT NULL CHECK (amount_cents >= 0),
  billing_cycle  TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'per_term', 'per_session')),
  archived_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

-- a course is what a parent enrolls a student in, sessions are generated from its slots
CREATE TABLE courses (
  id                    UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id                UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  branch_id             UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  subject_id            UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  level_id              UUID REFERENCES levels(id) ON DELETE RESTRICT,  -- null = mixed levels
  term_id               UUID REFERENCES terms(id) ON DELETE SET NULL,
  fee_plan_id           UUID REFERENCES fee_plans(id) ON DELETE RESTRICT,
  name                  TEXT NOT NULL,
  description           TEXT,
  default_tutor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  default_classroom_id  UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  capacity              INTEGER NOT NULL CHECK (capacity > 0),
  starts_on             DATE NOT NULL,
  ends_on               DATE,  -- null = open ended
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
CREATE INDEX courses_org_status_idx ON courses (org_id, status);
CREATE INDEX courses_branch_idx ON courses (branch_id);
CREATE INDEX courses_tutor_idx ON courses (default_tutor_id);

-- weekly slots, a course may meet on several weekdays
CREATE TABLE course_slots (
  id                UUID PRIMARY KEY DEFAULT uuidv7(),
  course_id         UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  weekday           SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0 = sunday
  start_time        TIME NOT NULL,
  duration_minutes  INTEGER NOT NULL CHECK (duration_minutes > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, weekday, start_time)
);

CREATE TABLE leave_requests (
  id             UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id         UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_on      DATE NOT NULL,
  ends_on        DATE NOT NULL,
  leave_type     TEXT NOT NULL CHECK (leave_type IN ('annual', 'medical', 'other')),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reason         TEXT,
  decided_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at     TIMESTAMPTZ,
  decision_note  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);
CREATE INDEX leave_requests_user_dates_idx ON leave_requests (user_id, starts_on, ends_on);
CREATE INDEX leave_requests_org_status_idx ON leave_requests (org_id, status);

-- a dated occurrence of a course. tutor_id and classroom_id are copied from the course
-- at generation time and may be overridden per session (cover teacher, room swap)
CREATE TABLE sessions (
  id                  UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id              UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  course_id           UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  slot_id             UUID REFERENCES course_slots(id) ON DELETE SET NULL,  -- null for ad hoc
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ NOT NULL,
  tutor_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  classroom_id        UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  cancel_reason       TEXT,
  cover_for_leave_id  UUID REFERENCES leave_requests(id) ON DELETE SET NULL,
  lesson_notes        TEXT,
  homework            TEXT,
  is_adhoc            BOOLEAN NOT NULL DEFAULT FALSE,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  UNIQUE (course_id, starts_at),
  -- hard conflict rules, enforced atomically (succeed completely or not run at all) by the database
  CONSTRAINT sessions_no_classroom_overlap
    EXCLUDE USING gist (classroom_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
    WHERE (status = 'scheduled'),
  CONSTRAINT sessions_no_tutor_overlap
    EXCLUDE USING gist (tutor_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
    WHERE (status = 'scheduled')
);
CREATE INDEX sessions_org_starts_idx ON sessions (org_id, starts_at);
CREATE INDEX sessions_course_starts_idx ON sessions (course_id, starts_at);
CREATE INDEX sessions_tutor_starts_idx ON sessions (tutor_id, starts_at);
CREATE INDEX sessions_classroom_starts_idx ON sessions (classroom_id, starts_at);

CREATE TABLE tutor_availability (
  id          UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, weekday, start_time),
  CHECK (end_time > start_time)
);

-- ---------------------------------------------------------------------------
-- enrollment, waitlist, make ups, attendance
-- ---------------------------------------------------------------------------
CREATE TABLE enrollments (
  id                  UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id              UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id           UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  starts_on           DATE NOT NULL,
  ends_on             DATE,
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'withdrawn', 'completed')),
  fee_override_cents  BIGINT CHECK (fee_override_cents IS NULL OR fee_override_cents >= 0),
  enrolled_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  withdrawn_at        TIMESTAMPTZ,
  withdraw_reason     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
CREATE UNIQUE INDEX enrollments_one_active_per_course_uq
  ON enrollments (student_id, course_id) WHERE status = 'active';
CREATE INDEX enrollments_course_status_idx ON enrollments (course_id, status);
CREATE INDEX enrollments_student_status_idx ON enrollments (student_id, status);

CREATE TABLE waitlist_entries (
  id                UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id         UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting', 'offered', 'accepted', 'expired', 'withdrawn')),
  offered_at        TIMESTAMPTZ,
  offer_expires_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX waitlist_entries_one_open_per_course_uq
  ON waitlist_entries (student_id, course_id) WHERE status IN ('waiting', 'offered');
CREATE INDEX waitlist_entries_course_queue_idx ON waitlist_entries (course_id, created_at)
  WHERE status = 'waiting';

CREATE TABLE makeup_bookings (
  id                        UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id                    UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  student_id                UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  credited_from_session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  booked_session_id         UUID REFERENCES sessions(id) ON DELETE SET NULL,
  status                    TEXT NOT NULL DEFAULT 'available'
                            CHECK (status IN ('available', 'booked', 'used', 'expired', 'forfeited')),
  expires_on                DATE NOT NULL,
  granted_by                UUID REFERENCES users(id) ON DELETE SET NULL,
  booked_at                 TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, credited_from_session_id)
);
CREATE INDEX makeup_bookings_student_status_idx ON makeup_bookings (student_id, status);
CREATE INDEX makeup_bookings_booked_session_idx ON makeup_bookings (booked_session_id);

-- roster for a session is derived: active enrollments covering the session date plus
-- make up bookings for that session. exactly one of enrollment_id / makeup_booking_id is set
CREATE TABLE attendance (
  id                 UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id             UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  session_id         UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id      UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  makeup_booking_id  UUID REFERENCES makeup_bookings(id) ON DELETE SET NULL,
  status             TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes              TEXT,
  marked_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  marked_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id),
  CHECK ((enrollment_id IS NULL) <> (makeup_booking_id IS NULL))
);
CREATE INDEX attendance_student_idx ON attendance (student_id);
CREATE INDEX attendance_enrollment_idx ON attendance (enrollment_id);

-- ---------------------------------------------------------------------------
-- billing
-- ---------------------------------------------------------------------------
CREATE TABLE invoice_counters (
  org_id      UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  next_value  BIGINT NOT NULL DEFAULT 1
);

-- issued invoices are immutable, corrections are credit notes or void and reissue
-- "overdue" is derived: status in ('issued','partially_paid') and due_on < current_date
CREATE TABLE invoices (
  id               UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  invoice_number   TEXT NOT NULL,
  bill_to_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'void')),
  issued_at        TIMESTAMPTZ,
  due_on           DATE,
  period_start     DATE,
  period_end       DATE,
  subtotal_cents   BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  discount_cents   BIGINT NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  tax_cents        BIGINT NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents      BIGINT NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  paid_cents       BIGINT NOT NULL DEFAULT 0 CHECK (paid_cents >= 0 AND paid_cents <= total_cents),
  voided_at        TIMESTAMPTZ,
  void_reason      TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, invoice_number)
);
CREATE INDEX invoices_bill_to_status_idx ON invoices (bill_to_user_id, status);
CREATE INDEX invoices_open_due_idx ON invoices (org_id, due_on)
  WHERE status IN ('issued', 'partially_paid');

-- voided_at is copied from the parent invoice when it is voided so the tuition
-- uniqueness rule below releases the period for reissue while keeping the history
CREATE TABLE invoice_lines (
  id             UUID PRIMARY KEY DEFAULT uuidv7(),
  invoice_id     UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  student_id     UUID REFERENCES students(id) ON DELETE SET NULL,
  enrollment_id  UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  line_type      TEXT NOT NULL
                 CHECK (line_type IN ('tuition', 'registration', 'material', 'discount', 'adjustment')),
  description    TEXT NOT NULL,
  quantity       NUMERIC(8, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cents     BIGINT NOT NULL,
  amount_cents   BIGINT NOT NULL,
  period_start   DATE,
  period_end     DATE,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  voided_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX invoice_lines_tuition_period_uq
  ON invoice_lines (enrollment_id, period_start)
  WHERE line_type = 'tuition' AND voided_at IS NULL;
CREATE INDEX invoice_lines_invoice_idx ON invoice_lines (invoice_id);
CREATE INDEX invoice_lines_student_idx ON invoice_lines (student_id);

CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  payer_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  amount_cents      BIGINT NOT NULL CHECK (amount_cents > 0),
  method            TEXT NOT NULL CHECK (method IN ('cash', 'paynow', 'bank_transfer', 'card', 'cheque')),
  status            TEXT NOT NULL DEFAULT 'succeeded'
                    CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference         TEXT,
  provider          TEXT,
  provider_payload  JSONB,
  recorded_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payments_provider_reference_uq
  ON payments (provider, reference) WHERE provider IS NOT NULL;
CREATE INDEX payments_payer_idx ON payments (payer_user_id, received_at);

-- sum of allocations for a payment must not exceed payment.amount_cents and
-- sum for an invoice must not exceed invoice.total_cents. enforced by the service
-- inside the same transaction that updates invoices.paid_cents and status
CREATE TABLE payment_allocations (
  id            UUID PRIMARY KEY DEFAULT uuidv7(),
  payment_id    UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount_cents  BIGINT NOT NULL CHECK (amount_cents > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_id, invoice_id)
);
CREATE INDEX payment_allocations_invoice_idx ON payment_allocations (invoice_id);

CREATE TABLE credit_notes (
  id            UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount_cents  BIGINT NOT NULL CHECK (amount_cents > 0),
  reason        TEXT NOT NULL,
  issued_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- insert first, process second, makes provider retries harmless
CREATE TABLE webhook_events (
  id                 UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id             UUID REFERENCES organisations(id) ON DELETE CASCADE,
  provider           TEXT NOT NULL,
  provider_event_id  TEXT NOT NULL,
  payload            JSONB NOT NULL,
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at       TIMESTAMPTZ,
  error              TEXT,
  UNIQUE (provider, provider_event_id)
);

-- ---------------------------------------------------------------------------
-- notifications (transactional outbox) and audit
-- ---------------------------------------------------------------------------
CREATE TABLE notification_preferences (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  event_key   TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel, event_key)
);

CREATE TABLE notifications (
  id                 UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id             UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  recipient_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel            TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  event_key          TEXT NOT NULL CHECK (event_key IN (
                       'session_reminder', 'session_cancelled', 'session_rescheduled', 'tutor_changed', 'student_absent',
                       'invoice_issued', 'invoice_overdue', 'waitlist_offer',
                       'leave_request_submitted', 'leave_request_decided',
                       'password_reset', 'account_created')),
  template           TEXT NOT NULL,
  payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key         TEXT UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  scheduled_for      TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts           INTEGER NOT NULL DEFAULT 0,
  sent_at            TIMESTAMPTZ,
  last_error         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_dispatch_idx ON notifications (scheduled_for) WHERE status = 'pending';
CREATE INDEX notifications_recipient_idx ON notifications (recipient_user_id, created_at);

-- append only, no updated_at, never deleted by the application
CREATE TABLE audit_log (
  id             UUID PRIMARY KEY DEFAULT uuidv7(),
  org_id         UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  actor_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  entity_id      UUID,
  before         JSONB,
  after          JSONB,
  ip             INET,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id);
CREATE INDEX audit_log_org_created_idx ON audit_log (org_id, created_at);
CREATE INDEX audit_log_actor_idx ON audit_log (actor_user_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organisations', 'organisation_settings', 'org_integrations', 'notification_event_settings',
    'users', 'branches', 'classrooms', 'closures', 'levels', 'subjects', 'students',
    'terms', 'fee_plans', 'courses', 'leave_requests', 'sessions', 'enrollments',
    'waitlist_entries', 'makeup_bookings', 'attendance', 'invoices', 'payments',
    'notification_preferences', 'notifications'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

COMMIT;