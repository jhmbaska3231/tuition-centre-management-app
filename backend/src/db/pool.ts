// backend/src/db/pool.ts
//
// one pool for the process, created lazily on first import, closed by closepool()
// during graceful shutdown

import { Pool, types } from 'pg';
import { config } from '../config';

// pg returns some types as strings by default to avoid precision loss. override the
// ones this schema relies on so repositories get the expected js types

// int8 (bigint), used for all *_cents columns. safe as a js number up to 2^53
types.setTypeParser(types.builtins.INT8, (v: string) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n)) {
    throw new Error(`BIGINT value ${v} exceeds Number.MAX_SAFE_INTEGER`);
  }
  return n;
});

// numeric (numeric). only invoice_lines.quantity uses it, two decimal places is safe
types.setTypeParser(types.builtins.NUMERIC, (v: string) => Number(v));

// date (date). by default pg builds a js date at local midnight, which shifts by a day
// depending on the server's timezone. keep calendar dates as 'yyyy-mm-dd' strings
types.setTypeParser(types.builtins.DATE, (v: string) => v);

// timestamptz stays a js date (the default), time stays a string (the default)

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  ssl: config.db.ssl,
  max: config.db.poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  keepAlive: true,
  application_name: 'tuition-api',
  // server side guard against a runaway query holding a connection
  statement_timeout: 30_000,
});

// fires for errors on idle clients (network drop, server restart). without a handler
// the process crashes. log and let the pool replace the client on next checkout
pool.on('error', err => {
  console.error('Database pool error on idle client:', { message: err.message, code: (err as any).code });
});

export const testConnection = async (): Promise<boolean> => {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    console.error('Database connection test failed:', (err as Error).message);
    return false;
  }
};

export const closePool = async (): Promise<void> => {
  await pool.end();
};