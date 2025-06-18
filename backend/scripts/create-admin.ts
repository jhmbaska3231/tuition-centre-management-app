// backend/scripts/create-admin.ts

import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { createDatabasePool, testDatabaseConnection } from '../src/config/database';
import { createDatabaseSchema } from '../src/database/schema';

dotenv.config();

interface AdminData {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  password: string;
}

const createAdminAccount = async (adminData: AdminData): Promise<void> => {
  const pool = createDatabasePool();
  
  try {
    console.log('Testing database connection...');
    const isConnected = await testDatabaseConnection(pool);
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }

    console.log('Ensuring database schema exists...');
    await createDatabaseSchema(pool);

    const { email, firstName, lastName, phone, password } = adminData;
    const trimmedEmail = email.trim().toLowerCase();

    // Check if user already exists
    console.log(`Checking if admin account with email ${trimmedEmail} already exists...`);
    const existingUser = await pool.query(
      'SELECT id, role FROM "User" WHERE email = $1',
      [trimmedEmail]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      if (user.role === 'admin') {
        console.log('Admin account with this email already exists');
        return;
      } else {
        console.log('User account with this email already exists but is not an admin');
        return;
      }
    }

    // Hash password
    console.log('Hashing password...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create admin user
    console.log('Creating admin account...');
    const result = await pool.query(
      `INSERT INTO "User" (email, password, role, first_name, last_name, phone, active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, email, role, first_name, last_name, created_at`,
      [trimmedEmail, hashedPassword, 'admin', firstName.trim(), lastName.trim(), phone?.trim() || null, true]
    );

    const admin = result.rows[0];
    console.log('Admin account created successfully!');
    console.log('Admin Details:');
    console.log(`  ID: ${admin.id}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Name: ${admin.first_name} ${admin.last_name}`);
    console.log(`  Created: ${admin.created_at}`);
    console.log('');
    console.log('IMPORTANT: Store these credentials securely!');
    console.log('Change the password immediately after first login!');

  } catch (error) {
    console.error('Failed to create admin account:', error);
    throw error;
  } finally {
    await pool.end();
  }
};

// CLI interface
const main = async (): Promise<void> => {
  // Check required environment variables
  const requiredEnvVars = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  // Get admin data from command line arguments or environment variables
  const email = process.env.ADMIN_EMAIL || process.argv[2];
  const firstName = process.env.ADMIN_FIRST_NAME || process.argv[3];
  const lastName = process.env.ADMIN_LAST_NAME || process.argv[4];
  const phone = process.env.ADMIN_PHONE || process.argv[5];
  const password = process.env.ADMIN_PASSWORD || process.argv[6];

  if (!email || !firstName || !lastName || !password) {
    console.error('Missing required arguments');
    console.log('');
    console.log('Usage:');
    console.log('  npm run create-admin <email> <firstName> <lastName> [phone] <password>');
    console.log('');
    console.log('Or set environment variables:');
    console.log('  ADMIN_EMAIL=admin@company.com');
    console.log('  ADMIN_FIRST_NAME=System');
    console.log('  ADMIN_LAST_NAME=Administrator');
    console.log('  ADMIN_PHONE=91234567 (optional)');
    console.log('  ADMIN_PASSWORD=your-secure-password');
    console.log('  npm run create-admin');
    console.log('');
    console.log('Example:');
    console.log('  npm run create-admin admin@tuition.com System Administrator 91234567 SecurePassword123!');
    process.exit(1);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('Invalid email format');
    process.exit(1);
  }

  // Validate password strength
  if (password.length < 8) {
    console.error('Password must be at least 8 characters long');
    process.exit(1);
  }

  console.log('Creating admin account with the following details:');
  console.log(`  Email: ${email}`);
  console.log(`  Name: ${firstName} ${lastName}`);
  console.log(`  Phone: ${phone || 'Not provided'}`);
  console.log('');

  try {
    await createAdminAccount({ email, firstName, lastName, phone, password });
  } catch (error) {
    console.error('Failed to create admin account');
    process.exit(1);
  }
};

// Run if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
}

export { createAdminAccount };