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
      DROP TABLE IF EXISTS "Student" CASCADE;
      DROP TABLE IF EXISTS "Branch" CASCADE;
      DROP TABLE IF EXISTS "User" CASCADE;
    `;
    // Comment out this 2 lines to persist database records
    await pool.query(dropTables);
    console.log('Dropped existing tables');

    // Create Users table
    const createUsersTable = `
      CREATE TABLE "User" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK (role IN ('parent', 'staff', 'admin')) NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        email_verified BOOLEAN DEFAULT FALSE,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await pool.query(createUsersTable);
    console.log('Users table created');

    // Create Branches table
    const createBranchesTable = `
      CREATE TABLE "Branch" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        manager_id UUID REFERENCES "User"(id) ON DELETE SET NULL,
        operating_hours JSONB,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await pool.query(createBranchesTable);
    console.log('Branches table created');

    // Create Students table
    const createStudentsTable = `
      CREATE TABLE "Student" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        grade TEXT,
        date_of_birth DATE,
        parent_id UUID REFERENCES "User"(id) ON DELETE SET NULL,
        home_branch_id UUID REFERENCES "Branch"(id) ON DELETE SET NULL,
        emergency_contact TEXT,
        medical_notes TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await pool.query(createStudentsTable);
    console.log('Students table created');

    // Create Classes table
    const createClassesTable = `
      CREATE TABLE "Class" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subject TEXT NOT NULL,
        description TEXT,
        level TEXT,
        tutor_id UUID REFERENCES "User"(id) ON DELETE SET NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP GENERATED ALWAYS AS (start_time + INTERVAL '1 minute' * duration_minutes) STORED,
        duration_minutes INTEGER NOT NULL,
        capacity INTEGER NOT NULL DEFAULT 10,
        price NUMERIC(10, 2),
        branch_id UUID REFERENCES "Branch"(id) ON DELETE SET NULL,
        created_by UUID REFERENCES "User"(id) ON DELETE SET NULL,
        recurring_type TEXT CHECK (recurring_type IN ('one-time', 'weekly', 'monthly')) DEFAULT 'one-time',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT valid_capacity CHECK (capacity > 0),
        CONSTRAINT valid_duration CHECK (duration_minutes > 0),
        CONSTRAINT valid_price CHECK (price >= 0)
      )
    `;
    await pool.query(createClassesTable);
    console.log('Classes table created');

    // Create Enrollments table
    const createEnrollmentsTable = `
      CREATE TABLE "Enrollment" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES "Student"(id) ON DELETE CASCADE,
        class_id UUID REFERENCES "Class"(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMP DEFAULT NOW(),
        enrolled_by UUID REFERENCES "User"(id) ON DELETE SET NULL,
        status TEXT CHECK (status IN ('enrolled', 'cancelled', 'completed', 'no-show')) DEFAULT 'enrolled',
        cancelled_at TIMESTAMP NULL,
        cancelled_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await pool.query(createEnrollmentsTable);
    console.log('Enrollments table created');

    // Create Payments table
    const createPaymentsTable = `
      CREATE TABLE "Payment" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES "Student"(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        paid BOOLEAN DEFAULT FALSE,
        payment_date TIMESTAMP NULL,
        payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'online', 'cheque')),
        reference_number TEXT,
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
      CREATE TABLE "Attendance" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES "Student"(id) ON DELETE CASCADE,
        class_id UUID REFERENCES "Class"(id) ON DELETE CASCADE,
        enrollment_id UUID REFERENCES "Enrollment"(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        time_in TIMESTAMP,
        time_out TIMESTAMP,
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
      'CREATE INDEX idx_user_email ON "User"(email)',
      'CREATE INDEX idx_user_role ON "User"(role)',
      'CREATE INDEX idx_user_active ON "User"(active)',
      'CREATE INDEX idx_branch_active ON "Branch"(active)',
      'CREATE INDEX idx_student_parent ON "Student"(parent_id)',
      'CREATE INDEX idx_student_branch ON "Student"(home_branch_id)',
      'CREATE INDEX idx_student_active ON "Student"(active)',
      'CREATE INDEX idx_student_names ON "Student"(first_name, last_name)',
      'CREATE INDEX idx_class_start_time ON "Class"(start_time)',
      'CREATE INDEX idx_class_branch ON "Class"(branch_id)',
      'CREATE INDEX idx_class_tutor ON "Class"(tutor_id)',
      'CREATE INDEX idx_class_active ON "Class"(active)',
      'CREATE INDEX idx_enrollment_student ON "Enrollment"(student_id)',
      'CREATE INDEX idx_enrollment_class ON "Enrollment"(class_id)',
      'CREATE INDEX idx_enrollment_status ON "Enrollment"(status)',
      'CREATE INDEX idx_enrollment_date ON "Enrollment"(enrolled_at)',
      'CREATE INDEX idx_payment_student_month ON "Payment"(student_id, month)',
      'CREATE INDEX idx_payment_date ON "Payment"(payment_date)',
      'CREATE INDEX idx_payment_status ON "Payment"(paid)',
      'CREATE INDEX idx_attendance_student ON "Attendance"(student_id)',
      'CREATE INDEX idx_attendance_class ON "Attendance"(class_id)',
      'CREATE INDEX idx_attendance_date ON "Attendance"(date)'
    ];

    for (const indexQuery of indexes) {
      await pool.query(indexQuery);
    }
    console.log('Database indexes created');

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

    console.log('Parent users created');

    // Create branches
    const branch1 = await pool.query(`
      INSERT INTO "Branch" (name, address, phone, email, manager_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, ['Main Branch', 'Block 123, Tampines Street 45, #05-67, Singapore 520123', '61234567', 'main@tuition.com', staffUser1.rows[0].id]);

    const branch2 = await pool.query(`
      INSERT INTO "Branch" (name, address, phone, email, manager_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, ['North Branch', '789 Orchard Road, #12-34, Lucky Plaza, Singapore 238863', '63457890', 'north@tuition.com', staffUser2.rows[0].id]);

    const branch3 = await pool.query(`
      INSERT INTO "Branch" (name, address, phone, email, manager_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, ['East Branch', '21 Jurong East Avenue 1, #03-09, Singapore 609732', '62223344', 'east@tuition.com', staffUser3.rows[0].id]);

    const branch4 = await pool.query(`
      INSERT INTO "Branch" (name, address, phone, email)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, ['West Branch', '456 Bedok North Street 3, #10-88, Singapore 460456', '65557788', 'west@tuition.com']);

    console.log('Branches created');

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

    console.log('Students created');

    // Create classes with varied scheduling
    const classesData = [
      // Mathematics classes
      ['Mathematics', 'Basic algebra and geometry for Secondary 1', 'Secondary 1', staffUser1.rows[0].id, 1, 90, 15, 80.00, branch1.rows[0].id],
      ['Mathematics', 'Advanced mathematics for Secondary 3', 'Secondary 3', staffUser2.rows[0].id, 2, 120, 12, 120.00, branch2.rows[0].id],
      ['Mathematics', 'Primary mathematics fundamentals', 'Primary 5', staffUser3.rows[0].id, 3, 60, 20, 60.00, branch3.rows[0].id],
      
      // English classes
      ['English', 'English composition and comprehension', 'Secondary 1', staffUser2.rows[0].id, 5, 90, 18, 75.00, branch1.rows[0].id],
      ['English', 'Advanced English literature', 'Secondary 3', staffUser1.rows[0].id, 6, 90, 15, 100.00, branch2.rows[0].id],
      ['English', 'Primary English basics', 'Primary 5', staffUser3.rows[0].id, 7, 60, 25, 50.00, branch3.rows[0].id],
      
      // Science classes
      ['Science', 'General science concepts', 'Secondary 1', staffUser3.rows[0].id, 8, 90, 16, 85.00, branch1.rows[0].id],
      ['Science', 'Physics and chemistry fundamentals', 'Secondary 3', staffUser1.rows[0].id, 10, 120, 12, 130.00, branch2.rows[0].id],
      ['Science', 'Primary science exploration', 'Primary 5', staffUser2.rows[0].id, 12, 60, 22, 55.00, branch4.rows[0].id],
      
      // Additional subjects
      ['Chinese', 'Mandarin language skills', 'Secondary 1', staffUser2.rows[0].id, 14, 75, 20, 70.00, branch3.rows[0].id],
      ['History', 'Singapore and world history', 'Secondary 3', staffUser3.rows[0].id, 15, 90, 18, 65.00, branch1.rows[0].id],
      ['Art', 'Creative expression and techniques', 'Primary 5', staffUser1.rows[0].id, 17, 90, 15, 45.00, branch4.rows[0].id],
    ];

    for (let i = 0; i < classesData.length; i++) {
      const [subject, description, level, tutorId, daysFromNow, duration, capacity, price, branchId] = classesData[i];
      
      const classDate = new Date();
      classDate.setDate(classDate.getDate() + (daysFromNow as number));
      classDate.setHours(10 + (i % 8), 0, 0, 0); // Vary start times between 10 AM and 5 PM
      
      await pool.query(`
        INSERT INTO "Class" (subject, description, level, tutor_id, start_time, duration_minutes, capacity, price, branch_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [subject, description, level, tutorId, classDate, duration, capacity, price, branchId, tutorId]);
    }

    console.log('Classes created');

    // Create payment records
    const currentMonth = new Date().toISOString().slice(0, 7);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthString = lastMonth.toISOString().slice(0, 7);

    const paymentData = [
      [student1.rows[0].id, currentMonth, 150.00, true, new Date(), 'card'],
      [student1.rows[0].id, lastMonthString, 150.00, true, lastMonth, 'bank_transfer'],
      [student2.rows[0].id, currentMonth, 120.00, false, null, null],
      [student2.rows[0].id, lastMonthString, 120.00, true, lastMonth, 'cash'],
      [student3.rows[0].id, currentMonth, 180.00, true, new Date(), 'online'],
    ];

    for (const [studentId, month, amount, paid, paymentDate, method] of paymentData) {
      await pool.query(`
        INSERT INTO "Payment" (student_id, month, amount, paid, payment_date, payment_method)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [studentId, month, amount, paid, paymentDate, method]);
    }

    console.log('Payment records created');
    console.log('Database seeding completed!');

  } catch (error) {
    console.error('Database seeding failed:', error);
    throw error;
  }
};