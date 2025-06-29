// backend/src/config/database.ts

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Validate required database environment variables
const requiredDbVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const envVar of requiredDbVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL: Missing required database environment variable: ${envVar}`);
    process.exit(1);
  }
}

export const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT!, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  ssl: process.env.PGSSLMODE ? { // Add SSL configuration
    rejectUnauthorized: process.env.PGSSLREJECTUNAUTHORIZED === 'true'
  } : false,
  keepAlive: true, // Enable connection keepalive
  keepAliveInitialDelayMillis: 10000,
};

// Create and export the connection pool
export const createDatabasePool = (): Pool => {
  const pool = new Pool(dbConfig);

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Database pool error:', {
      message: err.message,
      code: (err as any).code,
      timestamp: new Date().toISOString()
    });
    // Don't exit process immediately - let the app handle gracefully
    console.error('Database connection lost. Attempting to reconnect...');
  });

  pool.on('connect', (client) => {
    console.log('Database connection established');
    // Set session timezone to UTC for consistency
    client.query('SET timezone="UTC"', (err) => {
      if (err) {
        console.warn('Failed to set session timezone:', err.message);
      }
    });
  });

  return pool;
};

// Test database connection with timeout
export const testDatabaseConnection = async (pool: Pool): Promise<boolean> => {
  try {
    // Use a timeout to prevent hanging connections
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout')), 5000);
    });

    const connectionPromise = (async () => {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as server_time, version() as version');
      client.release();
      return result;
    })();

    const result = await Promise.race([connectionPromise, timeoutPromise]);
    
    // Don't log sensitive database version info in production
    if (process.env.NODE_ENV === 'development') {
      console.log('Database connection test successful:', (result as any).rows[0].server_time);
    } else {
      console.log('Database connection test successful');
    }
    
    return true;
  } catch (error) {
    console.error('Database connection test failed:', {
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    });
    return false;
  }
};