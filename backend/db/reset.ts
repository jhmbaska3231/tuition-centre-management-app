// backend/db/reset.ts

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client } from 'pg';
import { seedDev } from './seed/dev';

dotenv.config();

const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const v of required) {
  if (!process.env[v]) {
    console.error(`Missing required environment variable: ${v}`);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'development') {
  console.error('db:reset refuses to run unless NODE_ENV=development');
  process.exit(1);
}

const base = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT!, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};
const dbName = process.env.DB_NAME!;

const recreateDatabase = async (): Promise<void> => {
  const admin = new Client({ ...base, database: 'postgres' });
  await admin.connect();
  try {
    await admin.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [dbName]
    );
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await admin.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Database ${dbName} recreated`);
  } finally {
    await admin.end();
  }
};

const applySchema = async (): Promise<void> => {
  const dir = path.join(__dirname, 'schema');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const client = new Client({ ...base, database: dbName });
  await client.connect();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      await client.query(sql);
      console.log(`Applied ${file}`);
    }
  } finally {
    await client.end();
  }
};

const main = async (): Promise<void> => {
  await recreateDatabase();
  await applySchema();
  await seedDev({ ...base, database: dbName });
  console.log('Reset complete');
};

main().catch(err => {
  console.error('Reset failed:', err);
  process.exit(1);
});