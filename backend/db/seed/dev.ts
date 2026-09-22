// backend/db/seed/dev.ts

import bcrypt from 'bcrypt';
import { Client, ClientConfig } from 'pg';
// registers the shared type parsers (bigint as number, date as string) on the pg module
import '../../src/db/pool';

const SG_OFFSET = '+08:00';
const PASSWORD = 'password123';

// date helpers, singapore has no dst so a fixed offset is correct
const sgToday = (): string => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (iso: string, n: number): string =>
  new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
// must produce the same string as runoverduereminders in billing/invoice-run.ts
// so a seeded reminder and a job generated one collapse onto one dedupe key
const weekKey = (iso: string): string =>
  `${iso.slice(0, 4)}-W${String(Math.ceil((new Date(iso).getTime() - new Date(`${iso.slice(0, 4)}-01-01`).getTime()) / 604_800_000)).padStart(2, '0')}`;
const weekdayOf = (iso: string): number => new Date(`${iso}T12:00:00Z`).getUTCDay();
const monthStart = (iso: string): string => `${iso.slice(0, 7)}-01`;
const monthEnd = (iso: string): string => {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const prevMonthDate = (iso: string): string => {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 15)).toISOString().slice(0, 10);
};
const at = (isoDate: string, time: string): string => `${isoDate}T${time}${SG_OFFSET}`;
const plusMinutes = (isoTs: string, mins: number): string =>
  new Date(new Date(isoTs).getTime() + mins * 60000).toISOString();

type Row = Record<string, any>;

const one = async (c: Client, sql: string, params: any[] = []): Promise<Row> => (await c.query(sql, params)).rows[0];

export const seedDev = async (config: ClientConfig): Promise<void> => {
  const c = new Client(config);
  await c.connect();
  const today = sgToday();
  const hash = await bcrypt.hash(PASSWORD, 10);

  try {
    await c.query('BEGIN');

    // organisation and settings
    const org = await one(c, `INSERT INTO organisations (name, slug) VALUES ($1, $2) RETURNING id`,
      ['Bright Minds Tuition', 'bright-minds']);
    const orgId = org.id;
    await c.query(`INSERT INTO organisation_settings (org_id) VALUES ($1)`, [orgId]);
    await c.query(`INSERT INTO invoice_counters (org_id) VALUES ($1)`, [orgId]);
    for (const key of ['session_reminder', 'session_cancelled', 'tutor_changed', 'student_absent',
      'invoice_issued', 'invoice_overdue', 'waitlist_offer', 'leave_request_submitted', 'leave_request_decided']) {
      await c.query(`INSERT INTO notification_event_settings (org_id, event_key) VALUES ($1, $2)`, [orgId, key]);
    }

    // users
    const user = async (email: string, role: string, first: string, last: string, phone: string): Promise<string> =>
      (await one(c, `INSERT INTO users (org_id, email, password_hash, role, first_name, last_name, phone)
                     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [orgId, email, hash, role, first, last, phone])).id;

    const admin = await user('admin@tuition.com', 'admin', 'System', 'Admin', '91000000');
    const manager = await user('ken.lim@tuition.com', 'branch_manager', 'Ken', 'Lim', '91000001');
    const tutorHui = await user('hui.siew@tuition.com', 'tutor', 'Hui', 'Siew', '91000002');
    const tutorZen = await user('zen.teo@tuition.com', 'tutor', 'Zen', 'Teo', '91000003');
    const tutorMary = await user('mary.wong@tuition.com', 'tutor', 'Mary', 'Wong', '91000004');
    const parentJay = await user('jaytoh@gmail.com', 'parent', 'Jay', 'Toh', '92000001');
    const parentAlice = await user('alice.lim@gmail.com', 'parent', 'Alice', 'Lim', '92000002');
    const parentBen = await user('ben.ng@gmail.com', 'parent', 'Ben', 'Ng', '92000003');
    const parentChloe = await user('chloe.tan@gmail.com', 'parent', 'Chloe', 'Tan', '92000004');
    const parentDavid = await user('david.koh@gmail.com', 'parent', 'David', 'Koh', '92000005');
    const parentEva = await user('eva.goh@gmail.com', 'parent', 'Eva', 'Goh', '92000006');

    // branches, classrooms, manager scope
    const branchA = (await one(c, `INSERT INTO branches (org_id, name, address, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
      [orgId, 'Tampines', '10 Tampines Central 1, Singapore 529536', '67800001'])).id;
    const branchB = (await one(c, `INSERT INTO branches (org_id, name, address, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
      [orgId, 'Jurong', '50 Jurong Gateway Road, Singapore 608549', '67800002'])).id;
    await c.query(`INSERT INTO user_branches (user_id, branch_id) VALUES ($1, $2)`, [manager, branchA]);

    // tutors belong to the branches they teach at, which is what lets a branch manager
    // see and approve their leave. mary teaches at both
    for (const [tutor, branch] of [[tutorHui, branchA], [tutorMary, branchA], [tutorMary, branchB], [tutorZen, branchB]]) {
      await c.query('INSERT INTO user_branches (user_id, branch_id) VALUES ($1, $2)', [tutor, branch]);
    }

    const room = async (branch: string, name: string, cap: number): Promise<string> =>
      (await one(c, `INSERT INTO classrooms (org_id, branch_id, name, capacity) VALUES ($1, $2, $3, $4) RETURNING id`,
        [orgId, branch, name, cap])).id;
    const roomA1 = await room(branchA, 'Room 1', 12);
    const roomA2 = await room(branchA, 'Room 2', 8);
    const roomB1 = await room(branchB, 'Room 1', 15);
    const roomB2 = await room(branchB, 'Room 2', 10);

    // a closure 10 days out, used to demonstrate the generator skipping a date
    const closureDate = addDays(today, 10);
    await c.query(`INSERT INTO closures (org_id, starts_on, ends_on, reason) VALUES ($1, $2, $2, $3)`,
      [orgId, closureDate, 'Public holiday (seed)']);

    // levels and subjects
    const levelCodes = ['K1', 'K2', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'S1', 'S2', 'S3', 'S4', 'S5', 'J1', 'J2', 'J3'];
    const levelNames: Record<string, string> = {
      K1: 'Kindergarten 1', K2: 'Kindergarten 2',
      P1: 'Primary 1', P2: 'Primary 2', P3: 'Primary 3', P4: 'Primary 4', P5: 'Primary 5', P6: 'Primary 6',
      S1: 'Secondary 1', S2: 'Secondary 2', S3: 'Secondary 3', S4: 'Secondary 4', S5: 'Secondary 5',
      J1: 'Junior College 1', J2: 'Junior College 2', J3: 'Junior College 3',
    };
    const levels: Record<string, string> = {};
    for (let i = 0; i < levelCodes.length; i++) {
      const code = levelCodes[i];
      levels[code] = (await one(c, `INSERT INTO levels (org_id, code, name, sort_order) VALUES ($1, $2, $3, $4) RETURNING id`,
        [orgId, code, levelNames[code], i + 1])).id;
    }

    const subjectNames = ['English', 'Mathematics', 'Science', 'Chinese', 'Malay', 'Tamil',
      'Additional Mathematics', 'Physics', 'Chemistry', 'Biology', 'Geography', 'History',
      'Literature', 'General Paper', 'Economics', 'Piano', 'Ballet', 'Art', 'Coding'];
    const subjects: Record<string, string> = {};
    for (const name of subjectNames) {
      subjects[name] = (await one(c, `INSERT INTO subjects (org_id, name) VALUES ($1, $2) RETURNING id`, [orgId, name])).id;
    }

    // term: started 4 weeks ago, ends 8 weeks from now
    const termStart = addDays(today, -28);
    const termEnd = addDays(today, 56);
    const termId = (await one(c, `INSERT INTO terms (org_id, name, starts_on, ends_on) VALUES ($1, $2, $3, $4) RETURNING id`,
      [orgId, 'Current Term', termStart, termEnd])).id;

    // fee plans
    const plan = async (name: string, cents: number, cycle: string): Promise<string> =>
      (await one(c, `INSERT INTO fee_plans (org_id, name, amount_cents, billing_cycle) VALUES ($1, $2, $3, $4) RETURNING id`,
        [orgId, name, cents, cycle])).id;
    const planPrimary = await plan('Primary monthly', 15000, 'monthly');
    const planSecondary = await plan('Secondary monthly', 18000, 'monthly');
    const planJC = await plan('JC monthly', 22000, 'monthly');
    const planEnrichment = await plan('Enrichment per term', 60000, 'per_term');

    // students and guardians
    const student = async (first: string, last: string, level: string | null, dob: string, branch: string,
      guardians: Array<[string, string, boolean]>): Promise<string> => {
      const id = (await one(c, `INSERT INTO students (org_id, first_name, last_name, level_id, date_of_birth, home_branch_id)
                                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [orgId, first, last, level ? levels[level] : null, dob, branch])).id;
      for (const [userId, rel, billing] of guardians) {
        await c.query(`INSERT INTO student_guardians (student_id, user_id, relationship, is_billing_contact) VALUES ($1, $2, $3, $4)`,
          [id, userId, rel, billing]);
      }
      return id;
    };

    const john = await student('John', 'Toh', 'S1', '2013-03-14', branchA, [[parentJay, 'father', true]]);
    const sarah = await student('Sarah', 'Toh', 'P5', '2015-08-02', branchA, [[parentJay, 'father', true]]);
    const emma = await student('Emma', 'Lim', 'S3', '2011-01-20', branchA, [[parentAlice, 'mother', true]]);
    const lily = await student('Lily', 'Ng', 'K2', '2020-05-11', branchB, [[parentBen, 'father', true]]);
    const marcus = await student('Marcus', 'Ng', 'P2', '2018-09-30', branchB, [[parentBen, 'father', true]]);
    const nathan = await student('Nathan', 'Ng', 'S4', '2010-07-23', branchB, [[parentBen, 'father', true]]);
    const chloeJr = await student('Rachel', 'Tan', 'P6', '2014-11-05', branchA, [[parentChloe, 'mother', true]]);
    const ryan = await student('Ryan', 'Koh', 'S4', '2010-06-18', branchB, [[parentDavid, 'father', true], [parentEva, 'mother', false]]);
    const grace = await student('Grace', 'Koh', 'J1', '2008-02-27', branchB, [[parentDavid, 'father', true], [parentEva, 'mother', false]]);
    const daniel = await student('Daniel', 'Goh', 'S4', '2010-12-09', branchA, [[parentEva, 'mother', true]]);
    const mei = await student('Mei', 'Goh', 'P4', '2016-04-22', branchA, [[parentEva, 'mother', true]]);

    // courses with weekly slots, weekday 0 = Sunday
    interface CourseSpec {
      name: string; subject: string; level: string | null; branch: string; tutor: string; room: string;
      capacity: number; plan: string; slots: Array<[number, string, number]>;
    }
    const courseSpecs: CourseSpec[] = [
      { name: 'Sec 1 Mathematics', subject: 'Mathematics', level: 'S1', branch: branchA, tutor: tutorHui, room: roomA1, capacity: 10, plan: planSecondary, slots: [[6, '10:00', 90]] },
      // a second s1 maths class so a make up credit from one has somewhere to go
      { name: 'Sec 1 Mathematics (Wed)', subject: 'Mathematics', level: 'S1', branch: branchA, tutor: tutorHui, room: roomA1, capacity: 10, plan: planSecondary, slots: [[3, '17:00', 90]] },
      { name: 'Pri 5 English', subject: 'English', level: 'P5', branch: branchA, tutor: tutorMary, room: roomA2, capacity: 8, plan: planPrimary, slots: [[6, '13:00', 90]] },
      { name: 'Sec 3 Mathematics', subject: 'Mathematics', level: 'S3', branch: branchA, tutor: tutorHui, room: roomA1, capacity: 10, plan: planSecondary, slots: [[6, '14:00', 120], [3, '19:00', 90]] },
      { name: 'K2 English', subject: 'English', level: 'K2', branch: branchB, tutor: tutorMary, room: roomB2, capacity: 6, plan: planPrimary, slots: [[0, '09:00', 60]] },
      { name: 'Pri 2 Mathematics', subject: 'Mathematics', level: 'P2', branch: branchB, tutor: tutorZen, room: roomB1, capacity: 12, plan: planPrimary, slots: [[0, '11:00', 90]] },
      { name: 'Sec 4 Chemistry', subject: 'Chemistry', level: 'S4', branch: branchB, tutor: tutorZen, room: roomB1, capacity: 2, plan: planSecondary, slots: [[6, '16:00', 120]] },
      { name: 'JC1 Economics', subject: 'Economics', level: 'J1', branch: branchB, tutor: tutorZen, room: roomB2, capacity: 10, plan: planJC, slots: [[2, '19:00', 120]] },
      { name: 'Piano (mixed)', subject: 'Piano', level: null, branch: branchA, tutor: tutorMary, room: roomA2, capacity: 4, plan: planEnrichment, slots: [[4, '17:00', 45]] },
    ];

    const courses: Record<string, string> = {};
    const slotIds: Record<string, Array<{ id: string; weekday: number; time: string; mins: number }>> = {};
    for (const spec of courseSpecs) {
      const id = (await one(c, `INSERT INTO courses (org_id, branch_id, subject_id, level_id, term_id, fee_plan_id, name,
                                  default_tutor_id, default_classroom_id, capacity, starts_on, ends_on, status, created_by)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'open', $13) RETURNING id`,
        [orgId, spec.branch, subjects[spec.subject], spec.level ? levels[spec.level] : null, termId, spec.plan, spec.name,
          spec.tutor, spec.room, spec.capacity, termStart, termEnd, admin])).id;
      courses[spec.name] = id;
      slotIds[spec.name] = [];
      for (const [weekday, time, mins] of spec.slots) {
        const slot = await one(c, `INSERT INTO course_slots (course_id, weekday, start_time, duration_minutes) VALUES ($1, $2, $3, $4) RETURNING id`,
          [id, weekday, time, mins]);
        slotIds[spec.name].push({ id: slot.id, weekday, time, mins });
      }
    }

    // sessions: from term start to term end (within a 12 week horizon), skipping closures
    // mirrors what the nightly generator will do
    const horizonEnd = addDays(today, 12 * 7);
    const sessionsByCourse: Record<string, Array<{ id: string; startsAt: string }>> = {};
    for (const spec of courseSpecs) {
      sessionsByCourse[spec.name] = [];
      for (const slot of slotIds[spec.name]) {
        let d = termStart;
        while (d <= termEnd && d <= horizonEnd) {
          if (weekdayOf(d) === slot.weekday && d !== closureDate) {
            const startsAt = at(d, `${slot.time}:00`);
            const endsAt = plusMinutes(startsAt, slot.mins);
            const isPast = new Date(startsAt).getTime() < Date.now();
            const s = await one(c, `INSERT INTO sessions (org_id, course_id, slot_id, starts_at, ends_at, tutor_id, classroom_id, status, created_by)
                                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                                    ON CONFLICT (course_id, starts_at) DO NOTHING RETURNING id, starts_at`,
              [orgId, courses[spec.name], slot.id, startsAt, endsAt, spec.tutor, spec.room, isPast ? 'completed' : 'scheduled', admin]);
            if (s) sessionsByCourse[spec.name].push({ id: s.id, startsAt: s.starts_at });
          }
          d = addDays(d, 1);
        }
      }
      sessionsByCourse[spec.name].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }

    // enrollments
    const enroll = async (studentId: string, courseName: string, startsOn: string, enrolledBy: string): Promise<string> =>
      (await one(c, `INSERT INTO enrollments (org_id, student_id, course_id, starts_on, enrolled_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [orgId, studentId, courses[courseName], startsOn, enrolledBy])).id;

    const enrollments: Record<string, string> = {};
    enrollments.john = await enroll(john, 'Sec 1 Mathematics', termStart, parentJay);
    enrollments.sarah = await enroll(sarah, 'Pri 5 English', termStart, parentJay);
    enrollments.emma = await enroll(emma, 'Sec 3 Mathematics', termStart, parentAlice);
    enrollments.lily = await enroll(lily, 'K2 English', termStart, parentBen);
    enrollments.marcus = await enroll(marcus, 'Pri 2 Mathematics', termStart, parentBen);
    enrollments.ryan = await enroll(ryan, 'Sec 4 Chemistry', termStart, parentDavid);
    enrollments.daniel = await enroll(daniel, 'Sec 4 Chemistry', termStart, parentEva);  // fills capacity of 2
    enrollments.grace = await enroll(grace, 'JC1 Economics', termStart, parentDavid);
    enrollments.mei = await enroll(mei, 'Piano (mixed)', addDays(today, -7), parentEva);  // mid term join
    enrollments.rachelPiano = await enroll(chloeJr, 'Piano (mixed)', termStart, parentChloe);

    // waitlist: sec 4 chemistry is full with ryan and daniel, nathan is next in line
    await c.query(`INSERT INTO waitlist_entries (org_id, student_id, course_id) VALUES ($1, $2, $3)`,
      [orgId, nathan, courses['Sec 4 Chemistry']]);

    // attendance for completed sessions, one excused absence for emma generates a make up credit
    const markPast = async (courseName: string, studentId: string, enrollmentId: string, pattern: string[]): Promise<void> => {
      const past = sessionsByCourse[courseName].filter(s => new Date(s.startsAt).getTime() < Date.now());
      for (let i = 0; i < past.length; i++) {
        const status = pattern[i % pattern.length];
        await c.query(`INSERT INTO attendance (org_id, session_id, student_id, enrollment_id, status, marked_by, marked_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [orgId, past[i].id, studentId, enrollmentId, status, tutorHui, plusMinutes(past[i].startsAt, 15)]);
        if (status === 'excused') {
          await c.query(`INSERT INTO makeup_bookings (org_id, student_id, credited_from_session_id, expires_on, granted_by)
                         VALUES ($1, $2, $3, $4, $5)`,
            [orgId, studentId, past[i].id, termEnd, tutorHui]);
        }
      }
    };
    await markPast('Sec 1 Mathematics', john, enrollments.john, ['present']);
    await markPast('Pri 5 English', sarah, enrollments.sarah, ['present', 'late', 'present']);
    await markPast('Sec 3 Mathematics', emma, enrollments.emma, ['present', 'present', 'excused', 'present', 'absent']);
    await markPast('K2 English', lily, enrollments.lily, ['present']);
    await markPast('Pri 2 Mathematics', marcus, enrollments.marcus, ['present', 'absent']);
    await markPast('Sec 4 Chemistry', ryan, enrollments.ryan, ['present']);
    await markPast('Sec 4 Chemistry', daniel, enrollments.daniel, ['present']);
    await markPast('JC1 Economics', grace, enrollments.grace, ['present']);

    // tutor availability and a pending leave request (hui, next week, tutor > approved by admin or manager)
    for (const [tutor, days] of [[tutorHui, [3, 6]], [tutorZen, [0, 2, 6]], [tutorMary, [0, 4, 6]]] as Array<[string, number[]]>) {
      for (const wd of days) {
        await c.query(`INSERT INTO tutor_availability (org_id, user_id, weekday, start_time, end_time) VALUES ($1, $2, $3, '09:00', '21:00')`,
          [orgId, tutor, wd]);
      }
    }
    await c.query(`INSERT INTO leave_requests (org_id, user_id, starts_on, ends_on, leave_type, reason)
                   VALUES ($1, $2, $3, $4, 'annual', 'Family trip')`,
      [orgId, tutorHui, addDays(today, 7), addDays(today, 9)]);

    // invoices, numbering uses the counter the same way the service will
    const nextInvoiceNumber = async (): Promise<string> => {
      const r = await one(c, `UPDATE invoice_counters SET next_value = next_value + 1 WHERE org_id = $1 RETURNING next_value - 1 AS n`, [orgId]);
      return `INV-${today.slice(0, 4)}-${String(r.n).padStart(6, '0')}`;
    };
    const invoice = async (billTo: string, periodStart: string, periodEnd: string, issuedAt: string, dueOn: string,
      lines: Array<[string, string, string, number]>): Promise<string> => {
      const subtotal = lines.reduce((s, l) => s + l[3], 0);
      const id = (await one(c, `INSERT INTO invoices (org_id, invoice_number, bill_to_user_id, status, issued_at, due_on,
                                  period_start, period_end, subtotal_cents, total_cents)
                                VALUES ($1, $2, $3, 'issued', $4, $5, $6, $7, $8, $8) RETURNING id`,
        [orgId, await nextInvoiceNumber(), billTo, at(issuedAt, '09:00:00'), dueOn, periodStart, periodEnd, subtotal])).id;
      let i = 0;
      for (const [studentId, enrollmentId, desc, cents] of lines) {
        await c.query(`INSERT INTO invoice_lines (invoice_id, student_id, enrollment_id, line_type, description, unit_cents, amount_cents, period_start, period_end, sort_order)
                       VALUES ($1, $2, $3, 'tuition', $4, $5, $5, $6, $7, $8)`,
          [id, studentId, enrollmentId, desc, cents, periodStart, periodEnd, i++]);
      }
      return id;
    };
    const pay = async (payer: string, cents: number, method: string, receivedOn: string, allocations: Array<[string, number]>): Promise<void> => {
      const pid = (await one(c, `INSERT INTO payments (org_id, payer_user_id, amount_cents, method, received_at, recorded_by)
                                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [orgId, payer, cents, method, at(receivedOn, '10:00:00'), admin])).id;
      for (const [invoiceId, alloc] of allocations) {
        await c.query(`INSERT INTO payment_allocations (payment_id, invoice_id, amount_cents) VALUES ($1, $2, $3)`, [pid, invoiceId, alloc]);
        await c.query(`UPDATE invoices SET paid_cents = paid_cents + $2,
                         status = CASE WHEN paid_cents + $2 >= total_cents THEN 'paid' ELSE 'partially_paid' END
                       WHERE id = $1`, [invoiceId, alloc]);
      }
    };

    const prevMonth = prevMonthDate(today);
    const pmStart = monthStart(prevMonth);
    const pmEnd = monthEnd(prevMonth);
    const cmStart = monthStart(today);
    const cmEnd = monthEnd(today);

    // jay: last month paid in full, this month issued and unpaid
    const jayPrev = await invoice(parentJay, pmStart, pmEnd, addDays(pmStart, -6), addDays(pmStart, 6), [
      [john, enrollments.john, 'Sec 1 Mathematics tuition', 18000],
      [sarah, enrollments.sarah, 'Pri 5 English tuition', 15000],
    ]);
    await pay(parentJay, 33000, 'paynow', addDays(pmStart, 2), [[jayPrev, 33000]]);
    await invoice(parentJay, cmStart, cmEnd, addDays(cmStart, -6), addDays(cmStart, 6), [
      [john, enrollments.john, 'Sec 1 Mathematics tuition', 18000],
      [sarah, enrollments.sarah, 'Pri 5 English tuition', 15000],
    ]);

    // alice: this month partially paid
    const alicePrev = await invoice(parentAlice, pmStart, pmEnd, addDays(pmStart, -6), addDays(pmStart, 6), [
      [emma, enrollments.emma, 'Sec 3 Mathematics tuition', 18000],
    ]);
    await pay(parentAlice, 18000, 'bank_transfer', addDays(pmStart, 4), [[alicePrev, 18000]]);
    const aliceCur = await invoice(parentAlice, cmStart, cmEnd, addDays(cmStart, -6), addDays(cmStart, 6), [
      [emma, enrollments.emma, 'Sec 3 Mathematics tuition', 18000],
    ]);
    await pay(parentAlice, 10000, 'cash', today, [[aliceCur, 10000]]);

    // ben: last month still unpaid, so overdue
    await invoice(parentBen, pmStart, pmEnd, addDays(pmStart, -6), addDays(pmStart, 6), [
      [lily, enrollments.lily, 'K2 English tuition', 15000],
      [marcus, enrollments.marcus, 'Pri 2 Mathematics tuition', 15000],
    ]);

    // david: billing contact for ryan and grace, last month paid
    const davidPrev = await invoice(parentDavid, pmStart, pmEnd, addDays(pmStart, -6), addDays(pmStart, 6), [
      [ryan, enrollments.ryan, 'Sec 4 Chemistry tuition', 18000],
      [grace, enrollments.grace, 'JC1 Economics tuition', 22000],
    ]);
    await pay(parentDavid, 40000, 'card', addDays(pmStart, 1), [[davidPrev, 40000]]);

    // notifications outbox: one already sent, one pending, both with real payloads
    const benOverdue = await one(c, `SELECT id, invoice_number, due_on, total_cents - paid_cents AS balance FROM invoices WHERE bill_to_user_id = $1 ORDER BY issued_at LIMIT 1`, [parentBen]);
    const jayPrevInv = await one(c, `SELECT invoice_number, due_on, total_cents FROM invoices WHERE id = $1`, [jayPrev]);
    await c.query(`INSERT INTO notifications (org_id, recipient_user_id, channel, event_key, template, payload, dedupe_key, status, sent_at)
                   VALUES ($1, $2, 'email', 'invoice_issued', 'invoice_issued_v1', $3, $4, 'sent', now() - interval '1 day')`,
      [orgId, parentJay,
        JSON.stringify({ invoiceId: jayPrev, invoiceNumber: jayPrevInv.invoice_number, totalCents: Number(jayPrevInv.total_cents), dueOn: jayPrevInv.due_on }),
        `invoice_issued:${jayPrev}`]);

    await c.query(`INSERT INTO notifications (org_id, recipient_user_id, channel, event_key, template, payload, dedupe_key)
                   VALUES ($1, $2, 'email', 'invoice_overdue', 'invoice_overdue_v1', $3, $4)`,
      [orgId, parentBen,
        JSON.stringify({ invoiceId: benOverdue.id, invoiceNumber: benOverdue.invoice_number, dueOn: benOverdue.due_on, balanceCents: Number(benOverdue.balance) }),
        `invoice_overdue:${benOverdue.id}:${weekKey(today)}`]);

    await c.query(`INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
                   VALUES ($1, $2, 'seed.completed', 'organisation', $1, '{"source":"dev seed"}')`, [orgId, admin]);

    await c.query('COMMIT');
    console.log('Dev seed complete. All accounts use password: ' + PASSWORD);
    console.log('  admin@tuition.com (admin), ken.lim@tuition.com (branch_manager, Tampines)');
    console.log('  hui.siew@tuition.com, zen.teo@tuition.com, mary.wong@tuition.com (tutor)');
    console.log('  jaytoh@gmail.com, alice.lim@gmail.com, ben.ng@gmail.com, chloe.tan@gmail.com, david.koh@gmail.com, eva.goh@gmail.com (parent)');
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    await c.end();
  }
};

// allow running the seed on its own against an existing schema
if (require.main === module) {
  require('dotenv').config();
  seedDev({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT!, 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  }).catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}