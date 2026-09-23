// backend/src/modules/org/repository.ts

import { Queryable, execute, many, maybeOne, one } from '../../db';
import {
  BranchRow, ClassroomRow, ClosureRow, IntegrationRow, LevelRow, NotificationEventSettingRow,
  OrganisationRow, OrganisationSettingsRow, StaffRow, SubjectRow,
} from './types';

// builds "set col = $n, col2 = $n+1" from a partial object. keys are taken from a
// whitelist the caller controls (the zod schema), never from raw input
const setClause = (fields: Record<string, unknown>, startAt: number): { sql: string; params: unknown[] } => {
  const keys = Object.keys(fields);
  return {
    sql: keys.map((k, i) => `${k} = $${startAt + i}`).join(', '),
    params: keys.map(k => fields[k]),
  };
};

// organisation and settings -----------------------------------------------------------------

// the only organisation data an unauthenticated visitor can read. selects exactly the
// public columns rather than reading the whole settings row and filtering in the service,
// so a careless spread downstream cannot leak a private setting. left join so the sign in
// page still renders the centre name if the settings row is ever missing
export const findPublicOrganisation = (q: Queryable, orgId: string) =>
  one<{
    name: string; slug: string; timezone: string; currency: string;
    landing_headline: string | null; landing_description: string | null;
    accent_colour: string | null; logo_url: string | null;
  }>(q,
    `SELECT o.name, o.slug, o.timezone, o.currency,
            s.landing_headline, s.landing_description, s.accent_colour, s.logo_url
     FROM organisations o LEFT JOIN organisation_settings s ON s.org_id = o.id
     WHERE o.id = $1`, [orgId]);

export const findOrganisation = (q: Queryable, orgId: string) =>
  one<OrganisationRow>(q, 'SELECT * FROM organisations WHERE id = $1', [orgId]);

export const findSettings = (q: Queryable, orgId: string) =>
  one<OrganisationSettingsRow>(q, 'SELECT * FROM organisation_settings WHERE org_id = $1', [orgId]);

export const updateSettings = (q: Queryable, orgId: string, fields: Record<string, unknown>) => {
  const { sql, params } = setClause(fields, 2);
  return one<OrganisationSettingsRow>(q,
    `UPDATE organisation_settings SET ${sql} WHERE org_id = $1 RETURNING *`, [orgId, ...params]);
};

export const listEventSettings = (q: Queryable, orgId: string) =>
  many<NotificationEventSettingRow>(q,
    'SELECT event_key, enabled, updated_at FROM notification_event_settings WHERE org_id = $1 ORDER BY event_key', [orgId]);

export const upsertEventSetting = (q: Queryable, orgId: string, eventKey: string, enabled: boolean) =>
  one<NotificationEventSettingRow>(q,
    `INSERT INTO notification_event_settings (org_id, event_key, enabled) VALUES ($1, $2, $3)
     ON CONFLICT (org_id, event_key) DO UPDATE SET enabled = EXCLUDED.enabled
     RETURNING event_key, enabled, updated_at`,
    [orgId, eventKey, enabled]);

// integrations -----------------------------------------------------------------

export const listIntegrations = (q: Queryable, orgId: string) =>
  many<IntegrationRow>(q, 'SELECT * FROM org_integrations WHERE org_id = $1 ORDER BY kind', [orgId]);

export const findIntegration = (q: Queryable, orgId: string, kind: string) =>
  maybeOne<IntegrationRow>(q, 'SELECT * FROM org_integrations WHERE org_id = $1 AND kind = $2', [orgId, kind]);

export const upsertIntegration = (q: Queryable, i: {
  orgId: string; kind: string; provider: string; configEncrypted: Buffer; isActive: boolean; updatedBy: string;
}) =>
  one<IntegrationRow>(q,
    `INSERT INTO org_integrations (org_id, kind, provider, config_encrypted, is_active, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (org_id, kind) DO UPDATE
       SET provider = EXCLUDED.provider, config_encrypted = EXCLUDED.config_encrypted,
           is_active = EXCLUDED.is_active, updated_by = EXCLUDED.updated_by
     RETURNING *`,
    [i.orgId, i.kind, i.provider, i.configEncrypted, i.isActive, i.updatedBy]);

export const deleteIntegration = (q: Queryable, orgId: string, kind: string) =>
  execute(q, 'DELETE FROM org_integrations WHERE org_id = $1 AND kind = $2', [orgId, kind]);

// branches -----------------------------------------------------------------

export const listBranches = (q: Queryable, orgId: string, includeArchived: boolean) =>
  many<BranchRow>(q,
    `SELECT * FROM branches WHERE org_id = $1 ${includeArchived ? '' : 'AND archived_at IS NULL'} ORDER BY name`, [orgId]);

export const findBranch = (q: Queryable, orgId: string, id: string) =>
  maybeOne<BranchRow>(q, 'SELECT * FROM branches WHERE org_id = $1 AND id = $2', [orgId, id]);

export const insertBranch = (q: Queryable, orgId: string, b: { name: string; address: string; phone: string | null }) =>
  one<BranchRow>(q,
    'INSERT INTO branches (org_id, name, address, phone) VALUES ($1, $2, $3, $4) RETURNING *',
    [orgId, b.name, b.address, b.phone]);

export const updateBranch = (q: Queryable, orgId: string, id: string, fields: Record<string, unknown>) => {
  const { sql, params } = setClause(fields, 3);
  return one<BranchRow>(q, `UPDATE branches SET ${sql} WHERE org_id = $1 AND id = $2 RETURNING *`, [orgId, id, ...params]);
};

export const archiveBranch = (q: Queryable, orgId: string, id: string) =>
  one<BranchRow>(q, 'UPDATE branches SET archived_at = now() WHERE org_id = $1 AND id = $2 RETURNING *', [orgId, id]);

export const countOpenCoursesInBranch = async (q: Queryable, branchId: string) =>
  (await one<{ n: number }>(q,
    `SELECT count(*)::int AS n FROM courses WHERE branch_id = $1 AND status IN ('draft', 'open')`, [branchId])).n;

// classrooms -----------------------------------------------------------------

export const listClassrooms = (q: Queryable, orgId: string, branchId: string, includeArchived: boolean) =>
  many<ClassroomRow>(q,
    `SELECT * FROM classrooms WHERE org_id = $1 AND branch_id = $2 ${includeArchived ? '' : 'AND archived_at IS NULL'} ORDER BY name`,
    [orgId, branchId]);

export const findClassroom = (q: Queryable, orgId: string, id: string) =>
  maybeOne<ClassroomRow>(q, 'SELECT * FROM classrooms WHERE org_id = $1 AND id = $2', [orgId, id]);

export const insertClassroom = (q: Queryable, orgId: string, branchId: string, c: { name: string; capacity: number }) =>
  one<ClassroomRow>(q,
    'INSERT INTO classrooms (org_id, branch_id, name, capacity) VALUES ($1, $2, $3, $4) RETURNING *',
    [orgId, branchId, c.name, c.capacity]);

export const updateClassroom = (q: Queryable, orgId: string, id: string, fields: Record<string, unknown>) => {
  const { sql, params } = setClause(fields, 3);
  return one<ClassroomRow>(q, `UPDATE classrooms SET ${sql} WHERE org_id = $1 AND id = $2 RETURNING *`, [orgId, id, ...params]);
};

export const archiveClassroom = (q: Queryable, orgId: string, id: string) =>
  one<ClassroomRow>(q, 'UPDATE classrooms SET archived_at = now() WHERE org_id = $1 AND id = $2 RETURNING *', [orgId, id]);

// largest capacity among open courses that default to this room, or 0
export const maxOpenCourseCapacityForRoom = async (q: Queryable, classroomId: string) =>
  (await one<{ n: number }>(q,
    `SELECT COALESCE(max(capacity), 0)::int AS n FROM courses WHERE default_classroom_id = $1 AND status IN ('draft', 'open')`,
    [classroomId])).n;

export const countFutureSessionsInRoom = async (q: Queryable, classroomId: string) =>
  (await one<{ n: number }>(q,
    `SELECT count(*)::int AS n FROM sessions WHERE classroom_id = $1 AND status = 'scheduled' AND starts_at > now()`,
    [classroomId])).n;

// closures -----------------------------------------------------------------

export const listClosures = (q: Queryable, orgId: string, from: string | null, to: string | null) =>
  many<ClosureRow>(q,
    `SELECT * FROM closures WHERE org_id = $1
       AND ($2::date IS NULL OR ends_on >= $2) AND ($3::date IS NULL OR starts_on <= $3)
     ORDER BY starts_on`,
    [orgId, from, to]);

export const findClosure = (q: Queryable, orgId: string, id: string) =>
  maybeOne<ClosureRow>(q, 'SELECT * FROM closures WHERE org_id = $1 AND id = $2', [orgId, id]);

export const insertClosure = (q: Queryable, orgId: string, c: { branch_id: string | null; starts_on: string; ends_on: string; reason: string }) =>
  one<ClosureRow>(q,
    'INSERT INTO closures (org_id, branch_id, starts_on, ends_on, reason) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [orgId, c.branch_id, c.starts_on, c.ends_on, c.reason]);

export const deleteClosure = (q: Queryable, orgId: string, id: string) =>
  execute(q, 'DELETE FROM closures WHERE org_id = $1 AND id = $2', [orgId, id]);

// levels and subjects -----------------------------------------------------------------

export const listLevels = (q: Queryable, orgId: string, includeArchived: boolean) =>
  many<LevelRow>(q,
    `SELECT id, org_id, code, name, sort_order, archived_at FROM levels WHERE org_id = $1
     ${includeArchived ? '' : 'AND archived_at IS NULL'} ORDER BY sort_order, code`, [orgId]);

export const findLevel = (q: Queryable, orgId: string, id: string) =>
  maybeOne<LevelRow>(q, 'SELECT id, org_id, code, name, sort_order, archived_at FROM levels WHERE org_id = $1 AND id = $2', [orgId, id]);

export const insertLevel = (q: Queryable, orgId: string, l: { code: string; name: string; sort_order: number }) =>
  one<LevelRow>(q,
    'INSERT INTO levels (org_id, code, name, sort_order) VALUES ($1, $2, $3, $4) RETURNING id, org_id, code, name, sort_order, archived_at',
    [orgId, l.code, l.name, l.sort_order]);

export const updateLevel = (q: Queryable, orgId: string, id: string, fields: Record<string, unknown>) => {
  const { sql, params } = setClause(fields, 3);
  return one<LevelRow>(q,
    `UPDATE levels SET ${sql} WHERE org_id = $1 AND id = $2 RETURNING id, org_id, code, name, sort_order, archived_at`, [orgId, id, ...params]);
};

export const archiveLevel = (q: Queryable, orgId: string, id: string) =>
  one<LevelRow>(q,
    'UPDATE levels SET archived_at = now() WHERE org_id = $1 AND id = $2 RETURNING id, org_id, code, name, sort_order, archived_at', [orgId, id]);

export const countOpenCoursesForLevel = async (q: Queryable, levelId: string) =>
  (await one<{ n: number }>(q, `SELECT count(*)::int AS n FROM courses WHERE level_id = $1 AND status IN ('draft', 'open')`, [levelId])).n;

export const listSubjects = (q: Queryable, orgId: string, includeArchived: boolean) =>
  many<SubjectRow>(q,
    `SELECT id, org_id, name, archived_at FROM subjects WHERE org_id = $1 ${includeArchived ? '' : 'AND archived_at IS NULL'} ORDER BY name`, [orgId]);

export const findSubject = (q: Queryable, orgId: string, id: string) =>
  maybeOne<SubjectRow>(q, 'SELECT id, org_id, name, archived_at FROM subjects WHERE org_id = $1 AND id = $2', [orgId, id]);

export const insertSubject = (q: Queryable, orgId: string, name: string) =>
  one<SubjectRow>(q, 'INSERT INTO subjects (org_id, name) VALUES ($1, $2) RETURNING id, org_id, name, archived_at', [orgId, name]);

export const updateSubject = (q: Queryable, orgId: string, id: string, name: string) =>
  one<SubjectRow>(q, 'UPDATE subjects SET name = $3 WHERE org_id = $1 AND id = $2 RETURNING id, org_id, name, archived_at', [orgId, id, name]);

export const archiveSubject = (q: Queryable, orgId: string, id: string) =>
  one<SubjectRow>(q, 'UPDATE subjects SET archived_at = now() WHERE org_id = $1 AND id = $2 RETURNING id, org_id, name, archived_at', [orgId, id]);

export const countOpenCoursesForSubject = async (q: Queryable, subjectId: string) =>
  (await one<{ n: number }>(q, `SELECT count(*)::int AS n FROM courses WHERE subject_id = $1 AND status IN ('draft', 'open')`, [subjectId])).n;

// staff -----------------------------------------------------------------

const STAFF_SELECT = `
  SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.phone, u.last_login_at, u.archived_at, u.created_at,
         COALESCE(array_agg(ub.branch_id) FILTER (WHERE ub.branch_id IS NOT NULL), '{}') AS branch_ids
  FROM users u
  LEFT JOIN user_branches ub ON ub.user_id = u.id`;

export const listStaff = (q: Queryable, orgId: string, role: string | null, includeArchived: boolean) =>
  many<StaffRow>(q,
    `${STAFF_SELECT}
     WHERE u.org_id = $1 AND u.role IN ('tutor', 'branch_manager', 'admin')
       AND ($2::text IS NULL OR u.role = $2)
       ${includeArchived ? '' : 'AND u.archived_at IS NULL'}
     GROUP BY u.id ORDER BY u.role, u.first_name, u.last_name`,
    [orgId, role]);

export const findStaff = (q: Queryable, orgId: string, id: string) =>
  maybeOne<StaffRow>(q,
    `${STAFF_SELECT} WHERE u.org_id = $1 AND u.id = $2 AND u.role IN ('tutor', 'branch_manager', 'admin') GROUP BY u.id`,
    [orgId, id]);

export const updateStaff = (q: Queryable, orgId: string, id: string, fields: Record<string, unknown>) => {
  const { sql, params } = setClause(fields, 3);
  return execute(q, `UPDATE users SET ${sql} WHERE org_id = $1 AND id = $2`, [orgId, id, ...params]);
};

export const setStaffArchived = (q: Queryable, orgId: string, id: string, archived: boolean) =>
  execute(q, `UPDATE users SET archived_at = ${archived ? 'now()' : 'NULL'} WHERE org_id = $1 AND id = $2`, [orgId, id]);

export const replaceUserBranches = async (q: Queryable, userId: string, branchIds: string[]) => {
  await execute(q, 'DELETE FROM user_branches WHERE user_id = $1', [userId]);
  if (branchIds.length > 0) {
    await execute(q,
      'INSERT INTO user_branches (user_id, branch_id) SELECT $1, unnest($2::uuid[])', [userId, branchIds]);
  }
};

export const countActiveAdmins = async (q: Queryable, orgId: string) =>
  (await one<{ n: number }>(q,
    `SELECT count(*)::int AS n FROM users WHERE org_id = $1 AND role = 'admin' AND archived_at IS NULL`, [orgId])).n;

// future sessions this tutor is assigned to, used to warn before archiving
export const countFutureSessionsForTutor = async (q: Queryable, tutorId: string) =>
  (await one<{ n: number }>(q,
    `SELECT count(*)::int AS n FROM sessions WHERE tutor_id = $1 AND status = 'scheduled' AND starts_at > now()`, [tutorId])).n;