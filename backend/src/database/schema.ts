// backend/src/database/schema.ts

import { Pool } from 'pg';
import bcrypt from 'bcrypt';

export const createDatabaseSchema = async (pool: Pool) => {
  try {
    console.log('Setting up database schema...');

    // Enable UUID extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    console.log('UUID extension enabled');

    // Drop existing tables in correct order (for development)
    const dropTables = `
      DROP TABLE IF EXISTS "Attendance" CASCADE;
      DROP TABLE IF EXISTS "Payment" CASCADE;
      DROP TABLE IF EXISTS "Enrollment" CASCADE;
      DROP TABLE IF EXISTS "Class" CASCADE;
      DROP TABLE IF EXISTS "Classroom" CASCADE;
      DROP TABLE IF EXISTS "Student" CASCADE;
      DROP TABLE IF EXISTS "Branch" CASCADE;
      DROP TABLE IF EXISTS "User" CASCADE;
    `;
    // Only drop tables in development
    if (process.env.NODE_ENV === 'development') {
      await pool.query(dropTables);
      console.log('Dropped existing tables (development mode)');
    } else {
      console.log('Production mode: Preserving existing tables');
    }

    // Create Users table
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS "User" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK (role IN ('parent', 'staff', 'admin')) NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await pool.query(createUsersTable);
    console.log('Users table created');

    // Create Branches table
    const createBranchesTable = `
      CREATE TABLE IF NOT EXISTS "Branch" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await pool.query(createBranchesTable);
    console.log('Branches table created');

    // Create Classrooms table
    const createClassroomsTable = `
      CREATE TABLE IF NOT EXISTS "Classroom" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_name TEXT NOT NULL,
        description TEXT,
        room_capacity INTEGER NOT NULL CHECK (room_capacity > 0),
        branch_id UUID REFERENCES "Branch"(id) ON DELETE CASCADE,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT unique_room_per_branch UNIQUE(branch_id, room_name)
      )
    `;
    await pool.query(createClassroomsTable);
    console.log('Classrooms table created');

    // Create Students table
    const createStudentsTable = `
      CREATE TABLE IF NOT EXISTS "Student" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        grade TEXT,
        date_of_birth DATE,
        parent_id UUID REFERENCES "User"(id) ON DELETE CASCADE,
        home_branch_id UUID REFERENCES "Branch"(id) ON DELETE SET NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await pool.query(createStudentsTable);
    console.log('Students table created');

    // Create Classes table
    const createClassesTable = `
      CREATE TABLE IF NOT EXISTS "Class" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subject TEXT NOT NULL,
        description TEXT,
        level TEXT,
        tutor_id UUID REFERENCES "User"(id) ON DELETE SET NULL,
        classroom_id UUID NOT NULL REFERENCES "Classroom"(id) ON DELETE CASCADE,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP GENERATED ALWAYS AS (start_time + INTERVAL '1 minute' * duration_minutes) STORED,
        duration_minutes INTEGER NOT NULL,
        capacity INTEGER NOT NULL DEFAULT 10,
        branch_id UUID REFERENCES "Branch"(id) ON DELETE CASCADE,
        created_by UUID REFERENCES "User"(id) ON DELETE SET NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT valid_capacity CHECK (capacity > 0),
        CONSTRAINT valid_duration CHECK (duration_minutes > 0)
      )
    `;
    await pool.query(createClassesTable);
    console.log('Classes table created');

    // Create Enrollments table
    const createEnrollmentsTable = `
      CREATE TABLE IF NOT EXISTS "Enrollment" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES "Student"(id) ON DELETE CASCADE,
        class_id UUID REFERENCES "Class"(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMP DEFAULT NOW(),
        enrolled_by UUID REFERENCES "User"(id) ON DELETE SET NULL,
        status TEXT CHECK (status IN ('enrolled', 'cancelled', 'completed', 'no-show')) DEFAULT 'enrolled',
        cancelled_at TIMESTAMP NULL
      )
    `;
    await pool.query(createEnrollmentsTable);
    console.log('Enrollments table created');

    // Create Payments table
    const createPaymentsTable = `
      CREATE TABLE IF NOT EXISTS "Payment" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES "Student"(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        paid BOOLEAN DEFAULT FALSE,
        payment_date TIMESTAMP NULL,
        payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'online', 'cheque')),
        notes TEXT,
        processed_by UUID REFERENCES "User"(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        UNIQUE(student_id, month)
      )
    `;
    await pool.query(createPaymentsTable);
    console.log('Payments table created');

    // Create Attendance table
    const createAttendanceTable = `
      CREATE TABLE IF NOT EXISTS "Attendance" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES "Student"(id) ON DELETE CASCADE,
        class_id UUID REFERENCES "Class"(id) ON DELETE CASCADE,
        enrollment_id UUID REFERENCES "Enrollment"(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status TEXT CHECK (status IN ('present', 'absent', 'late', 'excused')) DEFAULT 'present',
        notes TEXT,
        marked_by UUID REFERENCES "User"(id) ON DELETE SET NULL,
        marked_at TIMESTAMP DEFAULT NOW(),
        
        UNIQUE(enrollment_id, date)
      )
    `;
    await pool.query(createAttendanceTable);
    console.log('Attendance table created');

    // Create indexes for performance
    const indexes = [
      // User indexes
      'CREATE INDEX IF NOT EXISTS idx_user_email ON "User"(email)',
      'CREATE INDEX IF NOT EXISTS idx_user_role ON "User"(role)',
      'CREATE INDEX IF NOT EXISTS idx_user_active ON "User"(active)',
      
      // Branch indexes  
      'CREATE INDEX IF NOT EXISTS idx_branch_active ON "Branch"(active)',
      
      // Classroom indexes
      'CREATE INDEX IF NOT EXISTS idx_classroom_branch ON "Classroom"(branch_id)',
      'CREATE INDEX IF NOT EXISTS idx_classroom_active ON "Classroom"(active)',
      'CREATE INDEX IF NOT EXISTS idx_classroom_name ON "Classroom"(room_name)',
      
      // Student indexes
      'CREATE INDEX IF NOT EXISTS idx_student_parent_active ON "Student"(parent_id, active)',
      'CREATE INDEX IF NOT EXISTS idx_student_branch ON "Student"(home_branch_id)',
      'CREATE INDEX IF NOT EXISTS idx_student_active ON "Student"(active)',
      'CREATE INDEX IF NOT EXISTS idx_student_names ON "Student"(first_name, last_name)',
      
      // Class indexes
      'CREATE INDEX IF NOT EXISTS idx_class_branch_time ON "Class"(branch_id, start_time)',
      'CREATE INDEX IF NOT EXISTS idx_class_subject ON "Class"(subject)',
      'CREATE INDEX IF NOT EXISTS idx_class_start_time ON "Class"(start_time)',
      'CREATE INDEX IF NOT EXISTS idx_class_classroom ON "Class"(classroom_id)',
      'CREATE INDEX IF NOT EXISTS idx_class_tutor ON "Class"(tutor_id)',
      'CREATE INDEX IF NOT EXISTS idx_class_active ON "Class"(active)',
      
      // Enrollment indexes
      'CREATE INDEX IF NOT EXISTS idx_enrollment_class_status ON "Enrollment"(class_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_enrollment_student ON "Enrollment"(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_enrollment_status ON "Enrollment"(status)',
      'CREATE INDEX IF NOT EXISTS idx_enrollment_date ON "Enrollment"(enrolled_at)',
      
      // Payment indexes
      'CREATE INDEX IF NOT EXISTS idx_payment_student_month ON "Payment"(student_id, month)',
      'CREATE INDEX IF NOT EXISTS idx_payment_date ON "Payment"(payment_date)',
      'CREATE INDEX IF NOT EXISTS idx_payment_status ON "Payment"(paid)',
      
      // Attendance indexes
      'CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON "Attendance"(class_id, date)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_student ON "Attendance"(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_date ON "Attendance"(date)'
    ];

    for (const indexQuery of indexes) {
      try {
        await pool.query(indexQuery);
      } catch (error) {
        // Ignore index creation errors (they might already exist)
        console.log(`Index creation skipped: ${indexQuery.split(' ')[5]}`);
      }
    }
    console.log('Database indexes ready');
    console.log('Database schema setup completed successfully!');

  } catch (error) {
    console.error('Database schema setup failed:', error);
    throw error;
  }
};

export const seedDatabase = async (pool: Pool) => {
  try {
    console.log('Seeding database with initial data...');

    // Hash the test password properly
    const saltRounds = 10;
    const testPassword = 'password123';
    const hashedPassword = await bcrypt.hash(testPassword, saltRounds);

    console.log('Hashing test passwords...');

    // Create admin user first
    const adminUser = await pool.query(`
      INSERT INTO "User" (email, password, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['admin@tuition.com', hashedPassword, 'admin', 'System', 'Administrator', '61234567']);

    console.log('Admin user created');

    // Create staff users for testing
    const staffUser1 = await pool.query(`
      INSERT INTO "User" (email, password, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['hui.siew@tuition.com', hashedPassword, 'staff', 'Hui', 'Siew', '96543210']);

    const staffUser2 = await pool.query(`
      INSERT INTO "User" (email, password, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['zen.teo@tuition.com', hashedPassword, 'staff', 'Zen', 'Teo', '92345678']);

    const staffUser3 = await pool.query(`
      INSERT INTO "User" (email, password, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['mary.wong@tuition.com', hashedPassword, 'staff', 'Mary', 'Wong', '90123456']);

    console.log('Staff users created');

    // Create parent users for testing
    const parentUser1 = await pool.query(`
      INSERT INTO "User" (email, password, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['jaytoh@gmail.com', hashedPassword, 'parent', 'Jay', 'Toh', '91234567']);

    const parentUser2 = await pool.query(`
      INSERT INTO "User" (email, password, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['alice.lim@gmail.com', hashedPassword, 'parent', 'Alice', 'Lim', '98765432']);

    const parentUser3 = await pool.query(`
      INSERT INTO "User" (email, password, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['david.wong@gmail.com', hashedPassword, 'parent', 'David', 'Wong', '85432110']);

    const parentUser4 = await pool.query(`
      INSERT INTO "User" (email, password, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['jenny.chen@gmail.com', hashedPassword, 'parent', 'Jenny', 'Chen', '87654321']);

    console.log('Parent users created');

    // Create branches
    const branch1 = await pool.query(`
      INSERT INTO "Branch" (name, address, phone)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Tampines Branch', '123 Tampines Street 11, #02-45, Singapore 529594', '67123456']);

    const branch2 = await pool.query(`
      INSERT INTO "Branch" (name, address, phone)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Jurong East Branch', '456 Jurong East Avenue 1, #03-21, Singapore 609123', '67234567']);

    const branch3 = await pool.query(`
      INSERT INTO "Branch" (name, address, phone)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Bishan Branch', '789 Bishan Street 23, #01-12, Singapore 570789', '67345678']);

    const branch4 = await pool.query(`
      INSERT INTO "Branch" (name, address, phone)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Woodlands Branch', '321 Woodlands Drive 14, #04-33, Singapore 730321', '67456789']);

    console.log('Branches created');

    // Create classrooms with appropriate capacities for different class types
    const classroomsData = [
      // Tampines Branch classrooms
      ['Room A1', 'Standard classroom with whiteboard', 25, branch1.rows[0].id],
      ['Room A2', 'Medium classroom with projector', 20, branch1.rows[0].id],
      ['Room A3', 'Small group classroom', 15, branch1.rows[0].id],
      ['Computer Lab', 'Computer lab with 20 workstations', 20, branch1.rows[0].id],
      
      // Jurong East Branch classrooms
      ['Room B1', 'Large classroom with multimedia setup', 30, branch2.rows[0].id],
      ['Art Studio', 'Creative space with art supplies', 15, branch2.rows[0].id],
      ['Music Room', 'Soundproof room with instruments', 12, branch2.rows[0].id],
      
      // Bishan Branch classrooms
      ['Room C1', 'Standard teaching room', 22, branch3.rows[0].id],
      ['Room C2', 'Interactive classroom with smart board', 18, branch3.rows[0].id],
      ['Science Lab', 'Laboratory with equipment for experiments', 16, branch3.rows[0].id],
      
      // Woodlands Branch classrooms
      ['Room D1', 'Flexible learning space', 24, branch4.rows[0].id],
      ['Room D2', 'Traditional classroom setup', 18, branch4.rows[0].id],
      ['Library Room', 'Quiet study environment', 14, branch4.rows[0].id]
    ];

    const classroomResults = [];
    for (const [roomName, description, roomCapacity, branchId] of classroomsData) {
      const result = await pool.query(`
        INSERT INTO "Classroom" (room_name, description, room_capacity, branch_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [roomName, description, roomCapacity, branchId]);
      classroomResults.push(result);
    }

    console.log('Classrooms created');

    // Create students
    const student1 = await pool.query(`
      INSERT INTO "Student" (first_name, last_name, grade, date_of_birth, parent_id, home_branch_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['John', 'Toh', 'Secondary 1', '2010-05-15', parentUser1.rows[0].id, branch1.rows[0].id]);

    const student2 = await pool.query(`
      INSERT INTO "Student" (first_name, last_name, grade, date_of_birth, parent_id, home_branch_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['Sarah', 'Toh', 'Primary 5', '2012-08-22', parentUser1.rows[0].id, branch1.rows[0].id]);

    const student3 = await pool.query(`
      INSERT INTO "Student" (first_name, last_name, grade, date_of_birth, parent_id, home_branch_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['Emma', 'Lim', 'Secondary 3', '2008-11-10', parentUser2.rows[0].id, branch2.rows[0].id]);

    const student4 = await pool.query(`
      INSERT INTO "Student" (first_name, last_name, grade, date_of_birth, parent_id, home_branch_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['Liam', 'Tan', 'Primary 4', '2013-03-27', parentUser2.rows[0].id, branch2.rows[0].id]);

    const student5 = await pool.query(`
      INSERT INTO "Student" (first_name, last_name, grade, date_of_birth, parent_id, home_branch_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['Olivia', 'Ng', 'Secondary 2', '2009-07-12', parentUser1.rows[0].id, branch1.rows[0].id]);

    const student6 = await pool.query(`
      INSERT INTO "Student" (first_name, last_name, grade, date_of_birth, parent_id, home_branch_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['Noah', 'Lee', 'Primary 6', '2011-10-05', parentUser2.rows[0].id, branch2.rows[0].id]);

    const student7 = await pool.query(`
      INSERT INTO "Student" (first_name, last_name, grade, date_of_birth, parent_id, home_branch_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['Isabella', 'Chua', 'Secondary 1', '2010-01-18', parentUser1.rows[0].id, branch1.rows[0].id]);

    const student8 = await pool.query(`
      INSERT INTO "Student" (first_name, last_name, grade, date_of_birth, parent_id, home_branch_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['Ethan', 'Wong', 'Primary 3', '2014-06-09', parentUser2.rows[0].id, branch2.rows[0].id]);

    // Additional students for testing
    const student9 = await pool.query(`
      INSERT INTO "Student" (first_name, last_name, grade, date_of_birth, parent_id, home_branch_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['Lily', 'Koh', 'Kindergarten 2', '2016-04-14', parentUser3.rows[0].id, branch2.rows[0].id]);

    const student10 = await pool.query(`
      INSERT INTO "Student" (first_name, last_name, grade, date_of_birth, parent_id, home_branch_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['Marcus', 'Lim', 'Primary 2', '2015-09-03', parentUser3.rows[0].id, branch3.rows[0].id]);

    const student11 = await pool.query(`
      INSERT INTO "Student" (first_name, last_name, grade, date_of_birth, parent_id, home_branch_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['Chloe', 'Tan', 'Primary 6', '2011-12-11', parentUser4.rows[0].id, branch3.rows[0].id]);

    const student12 = await pool.query(`
      INSERT INTO "Student" (first_name, last_name, grade, date_of_birth, parent_id, home_branch_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['Ryan', 'Chen', 'Secondary 4', '2007-07-25', parentUser4.rows[0].id, branch4.rows[0].id]);

    console.log('Students created');

    // Create classes with classroom assignments - Updated with capacity validation
    const classesData = [
      // Kindergarten classes with appropriate capacity
      ['English', 'Early English language skills for young learners', 'Kindergarten 2', staffUser3.rows[0].id, 1, 45, 8, branch2.rows[0].id, classroomResults[5].rows[0].id], // Art Studio (15 capacity)
      ['Art', 'Creative arts and crafts for kindergarten', 'Kindergarten 2', staffUser1.rows[0].id, 2, 60, 10, branch2.rows[0].id, classroomResults[6].rows[0].id], // Music Room (12 capacity)
      
      // Primary 1-2 classes
      ['Mathematics', 'Basic counting and arithmetic', 'Primary 1', staffUser2.rows[0].id, 3, 60, 12, branch4.rows[0].id, classroomResults[10].rows[0].id], // Room D1 (24 capacity)
      ['English', 'Phonics and basic reading skills', 'Primary 1', staffUser3.rows[0].id, 4, 60, 12, branch4.rows[0].id, classroomResults[11].rows[0].id], // Room D2 (18 capacity)
      ['Mathematics', 'Addition and subtraction fundamentals', 'Primary 2', staffUser1.rows[0].id, 5, 60, 15, branch3.rows[0].id, classroomResults[8].rows[0].id], // Room C2 (18 capacity)
      ['Chinese', 'Basic Mandarin for Primary 2', 'Primary 2', staffUser2.rows[0].id, 6, 60, 15, branch3.rows[0].id, classroomResults[7].rows[0].id], // Room C1 (22 capacity)
      
      // Primary 5-6 classes
      ['Mathematics', 'Primary mathematics fundamentals', 'Primary 5', staffUser3.rows[0].id, 7, 90, 20, branch1.rows[0].id, classroomResults[1].rows[0].id], // Room A2 (20 capacity)
      ['English', 'Primary English composition', 'Primary 5', staffUser1.rows[0].id, 8, 90, 18, branch1.rows[0].id, classroomResults[0].rows[0].id], // Room A1 (25 capacity)
      ['Science', 'Primary science exploration', 'Primary 5', staffUser2.rows[0].id, 9, 75, 20, branch1.rows[0].id, classroomResults[1].rows[0].id], // Room A2 (20 capacity)
      ['Mathematics', 'PSLE preparation mathematics', 'Primary 6', staffUser2.rows[0].id, 10, 120, 16, branch3.rows[0].id, classroomResults[9].rows[0].id], // Science Lab (16 capacity)
      ['English', 'PSLE English preparation', 'Primary 6', staffUser3.rows[0].id, 11, 120, 16, branch3.rows[0].id, classroomResults[8].rows[0].id], // Room C2 (18 capacity)
      
      // Secondary 1 classes
      ['Mathematics', 'Basic algebra and geometry for Secondary 1', 'Secondary 1', staffUser1.rows[0].id, 12, 90, 18, branch1.rows[0].id, classroomResults[1].rows[0].id], // Room A2 (20 capacity)
      ['English', 'English composition and comprehension', 'Secondary 1', staffUser2.rows[0].id, 13, 90, 18, branch1.rows[0].id, classroomResults[0].rows[0].id], // Room A1 (25 capacity)
      ['Science', 'General science concepts', 'Secondary 1', staffUser3.rows[0].id, 14, 90, 15, branch1.rows[0].id, classroomResults[2].rows[0].id], // Room A3 (15 capacity)
      
      // Secondary 3 classes
      ['Mathematics', 'Advanced mathematics for Secondary 3', 'Secondary 3', staffUser2.rows[0].id, 15, 120, 15, branch2.rows[0].id, classroomResults[5].rows[0].id], // Art Studio (15 capacity)
      ['English', 'Advanced English literature', 'Secondary 3', staffUser1.rows[0].id, 16, 90, 15, branch2.rows[0].id, classroomResults[2].rows[0].id], // Room A3 (15 capacity)
      ['Science', 'Physics and chemistry fundamentals', 'Secondary 3', staffUser3.rows[0].id, 17, 120, 12, branch2.rows[0].id, classroomResults[6].rows[0].id], // Music Room (12 capacity)
      
      // Secondary 4 classes (O-Level preparation)
      ['Mathematics', 'O-Level Mathematics preparation', 'Secondary 4', staffUser1.rows[0].id, 18, 120, 14, branch4.rows[0].id, classroomResults[12].rows[0].id], // Library Room (14 capacity)
      ['English', 'O-Level English preparation', 'Secondary 4', staffUser2.rows[0].id, 19, 120, 14, branch4.rows[0].id, classroomResults[12].rows[0].id], // Library Room (14 capacity)
      ['Science', 'O-Level combined science', 'Secondary 4', staffUser3.rows[0].id, 20, 150, 12, branch4.rows[0].id, classroomResults[12].rows[0].id], // Library Room (14 capacity)
      
      // Mixed level and general classes (no level specified - available to all)
      ['Computer Programming', 'Basic coding skills for all ages', null, staffUser1.rows[0].id, 21, 90, 20, branch1.rows[0].id, classroomResults[3].rows[0].id], // Computer Lab (20 capacity)
      ['Art', 'Creative expression and techniques', null, staffUser2.rows[0].id, 22, 90, 15, branch2.rows[0].id, classroomResults[5].rows[0].id], // Art studio (15 capacity)
      ['Music', 'Music appreciation and basic instruments', null, staffUser3.rows[0].id, 23, 75, 12, branch2.rows[0].id, classroomResults[6].rows[0].id], // Music Room (12 capacity)
      ['Chess', 'Strategic thinking through chess', null, staffUser1.rows[0].id, 24, 60, 12, branch4.rows[0].id, classroomResults[12].rows[0].id], // Library Room (14 capacity)
    ];

    for (let i = 0; i < classesData.length; i++) {
      const [subject, description, level, tutorId, daysFromNow, duration, capacity, branchId, classroomId] = classesData[i];
      
      const classDate = new Date();
      classDate.setDate(classDate.getDate() + (daysFromNow as number));
      classDate.setHours(10 + (i % 8), 0, 0, 0); // Vary start times between 10 AM and 5 PM
      
      await pool.query(`
        INSERT INTO "Class" (subject, description, level, tutor_id, classroom_id, start_time, duration_minutes, capacity, branch_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [subject, description, level, tutorId, classroomId, classDate, duration, capacity, branchId, tutorId]);
    }

    console.log('Classes created');

    // Create some enrollments for testing cascade behavior - matching students with appropriate grade levels
    await pool.query(`
      INSERT INTO "Enrollment" (student_id, class_id, enrolled_by, status)
      SELECT s.id, c.id, s.parent_id, 'enrolled'
      FROM "Student" s
      CROSS JOIN "Class" c
      WHERE s.first_name = 'John' AND s.grade = 'Secondary 1' 
        AND c.subject = 'Mathematics' AND c.level = 'Secondary 1'
      LIMIT 1
    `);

    await pool.query(`
      INSERT INTO "Enrollment" (student_id, class_id, enrolled_by, status)
      SELECT s.id, c.id, s.parent_id, 'enrolled'
      FROM "Student" s
      CROSS JOIN "Class" c
      WHERE s.first_name = 'Sarah' AND s.grade = 'Primary 5' 
        AND c.subject = 'English' AND c.level = 'Primary 5'
      LIMIT 1
    `);

    await pool.query(`
      INSERT INTO "Enrollment" (student_id, class_id, enrolled_by, status)
      SELECT s.id, c.id, s.parent_id, 'enrolled'
      FROM "Student" s
      CROSS JOIN "Class" c
      WHERE s.first_name = 'Emma' AND s.grade = 'Secondary 3' 
        AND c.subject = 'Mathematics' AND c.level = 'Secondary 3'
      LIMIT 1
    `);

    await pool.query(`
      INSERT INTO "Enrollment" (student_id, class_id, enrolled_by, status)
      SELECT s.id, c.id, s.parent_id, 'enrolled'
      FROM "Student" s
      CROSS JOIN "Class" c
      WHERE s.first_name = 'Lily' AND s.grade = 'Kindergarten 2' 
        AND c.subject = 'English' AND c.level = 'Kindergarten 2'
      LIMIT 1
    `);

    await pool.query(`
      INSERT INTO "Enrollment" (student_id, class_id, enrolled_by, status)
      SELECT s.id, c.id, s.parent_id, 'enrolled'
      FROM "Student" s
      CROSS JOIN "Class" c
      WHERE s.first_name = 'Marcus' AND s.grade = 'Primary 2' 
        AND c.subject = 'Mathematics' AND c.level = 'Primary 2'
      LIMIT 1
    `);

    await pool.query(`
      INSERT INTO "Enrollment" (student_id, class_id, enrolled_by, status)
      SELECT s.id, c.id, s.parent_id, 'enrolled'
      FROM "Student" s
      CROSS JOIN "Class" c
      WHERE s.first_name = 'Chloe' AND s.grade = 'Primary 6' 
        AND c.subject = 'Mathematics' AND c.level = 'Primary 6'
      LIMIT 1
    `);

    // Enroll some students in general classes (no level restriction)
    await pool.query(`
      INSERT INTO "Enrollment" (student_id, class_id, enrolled_by, status)
      SELECT s.id, c.id, s.parent_id, 'enrolled'
      FROM "Student" s
      CROSS JOIN "Class" c
      WHERE s.first_name = 'Ryan' AND c.subject = 'Computer Programming' AND c.level IS NULL
      LIMIT 1
    `);

    await pool.query(`
      INSERT INTO "Enrollment" (student_id, class_id, enrolled_by, status)
      SELECT s.id, c.id, s.parent_id, 'enrolled'
      FROM "Student" s
      CROSS JOIN "Class" c
      WHERE s.first_name = 'Sarah' AND c.subject = 'Art' AND c.level IS NULL
      LIMIT 1
    `);

    console.log('Enrollments created');

    // Create some payment records for testing
    const paymentData = [
      [student1.rows[0].id, '2024-01', 150.00, true, new Date('2024-01-05'), 'bank_transfer'],
      [student1.rows[0].id, '2024-02', 150.00, true, new Date('2024-02-05'), 'bank_transfer'],
      [student1.rows[0].id, '2024-03', 150.00, false, null, null],
      [student2.rows[0].id, '2024-01', 120.00, true, new Date('2024-01-05'), 'cash'],
      [student2.rows[0].id, '2024-02', 120.00, true, new Date('2024-02-05'), 'cash'],
      [student2.rows[0].id, '2024-03', 120.00, false, null, null],
      [student3.rows[0].id, '2024-01', 180.00, true, new Date('2024-01-10'), 'online'],
      [student3.rows[0].id, '2024-02', 180.00, false, null, null],
      [student4.rows[0].id, '2024-01', 100.00, true, new Date('2024-01-15'), 'card'],
      [student4.rows[0].id, '2024-02', 100.00, true, new Date('2024-02-15'), 'card']
    ];

    for (const [studentId, month, amount, paid, paymentDate, paymentMethod] of paymentData) {
      await pool.query(`
        INSERT INTO "Payment" (student_id, month, amount, paid, payment_date, payment_method, processed_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [studentId, month, amount, paid, paymentDate, paymentMethod, adminUser.rows[0].id]);
    }

    console.log('Payment records created');

    // Create some attendance records for testing
    const enrollmentResults = await pool.query(`
      SELECT e.id, e.student_id, e.class_id, c.start_time
      FROM "Enrollment" e
      JOIN "Class" c ON e.class_id = c.id
      WHERE e.status = 'enrolled'
      ORDER BY c.start_time
    `);

    for (const enrollment of enrollmentResults.rows) {
      const classDate = new Date(enrollment.start_time);
      classDate.setHours(0, 0, 0, 0); // Start of day for attendance date
      
      await pool.query(`
        INSERT INTO "Attendance" (student_id, class_id, enrollment_id, date, status, marked_by)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [enrollment.student_id, enrollment.class_id, enrollment.id, classDate, 'present', adminUser.rows[0].id]);
    }

    console.log('Attendance records created');
    console.log('Database seeding completed successfully!');

  } catch (error) {
    console.error('Database seeding failed:', error);
    throw error;
  }
};