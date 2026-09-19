-- backend/db/provision/bootstrap.sql
--
-- one time creation of the organisation, its settings rows, and the first admin user.
-- run once against a freshly provisioned production database, after 0001_baseline.sql
-- has been applied. safe to attempt twice: the org slug and user email are unique, so a
-- second run aborts without partially writing (everything is in one transaction)
--
-- the admin password hash must be generated locally so the plaintext never
-- appears in a command sent to the server:
--
--   cd backend
--   node -e "require('bcrypt').hash(process.argv[1], 12).then(console.log)" 'temporarypassword123'
--
-- usage:
--   psql "postgresql://tuition_app@host/tuition?sslmode=verify-full" -v on_error_stop=1 \
--     -v org_name="'<organisation_name>'" \
--     -v org_slug="'<organisation_slug>'" \
--     -v org_timezone="'asia/singapore'" \
--     -v org_currency="'sgd'" \
--     -v admin_email="'<admin_email>'" \
--     -v admin_first="'<first_name>'" \
--     -v admin_last="'<last_name>'" \
--     -v admin_hash="'<bcrypt_hash>'" \
--     -f backend/db/provision/bootstrap.sql

\set ON_ERROR_STOP on

BEGIN;

-- refuse to run if an organisation already exists. one deployment serves one centre, so
-- a second organisation row would make getCurrentOrgId() ambiguous
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM organisations) THEN
    RAISE EXCEPTION 'An organisation already exists. Bootstrap is a one-time operation.';
  END IF;
END;
$$;

-- 1. the organisation itself
INSERT INTO organisations (name, slug, timezone, currency)
VALUES (:org_name, :org_slug, :org_timezone, :org_currency);

-- 2. settings with every default from the schema. change them afterwards through
--    patch /api/org/settings rather than editing sql
INSERT INTO organisation_settings (org_id)
SELECT id FROM organisations WHERE slug = :org_slug;

-- 3. the invoice number counter, without this row the first invoice run fails
INSERT INTO invoice_counters (org_id)
SELECT id FROM organisations WHERE slug = :org_slug;

-- 4. one toggle row per notification event, all enabled. events absent from this table
--    are treated as enabled, but seeding them makes the admin ui show the full list
INSERT INTO notification_event_settings (org_id, event_key)
SELECT o.id, k
FROM organisations o,
     unnest(ARRAY[
       'session_reminder',
       'session_cancelled',
       'session_rescheduled',
       'tutor_changed',
       'student_absent',
       'invoice_issued',
       'invoice_overdue',
       'waitlist_offer',
       'leave_request_submitted',
       'leave_request_decided'
     ]) AS k
WHERE o.slug = :org_slug;

-- 5. the first admin, every other user is created through the api from here on
INSERT INTO users (org_id, email, password_hash, role, first_name, last_name)
SELECT id, :admin_email, :admin_hash, 'admin', :admin_first, :admin_last
FROM organisations WHERE slug = :org_slug;

-- 6. record the bootstrap in the audit trail. actor_user_id is the admin just created,
--    since no one else exists to attribute it to
INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
SELECT o.id, u.id, 'org.bootstrapped', 'organisation', o.id,
       jsonb_build_object('name', o.name, 'slug', o.slug, 'admin_email', u.email)
FROM organisations o
JOIN users u ON u.org_id = o.id AND u.role = 'admin'
WHERE o.slug = :org_slug;

COMMIT;

-- confirm the result
SELECT o.name, o.slug, o.timezone, o.currency, u.email AS admin_email
FROM organisations o JOIN users u ON u.org_id = o.id AND u.role = 'admin'
WHERE o.slug = :org_slug;