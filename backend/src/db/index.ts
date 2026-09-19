// backend/src/db/index.ts
//
// public surface of the db module, repositories import from here and nothing else

import { Pool, PoolClient, QueryResultRow } from 'pg';
import { config } from '../config';
import { pool, testConnection, closePool } from './pool';

export { pool, testConnection, closePool };
export * from './errors';

// anything that can run a query: the pool (auto checkout, no transaction) or a
// checked out client inside withtransaction. repository functions accept this type as
// their first argument so the same function works in and out of a transaction
export type Queryable = Pool | PoolClient;

const SLOW_QUERY_MS = 200;

const run = async <T extends QueryResultRow>(q: Queryable, sql: string, params: unknown[]): Promise<T[]> => {
  const startedAt = Date.now();
  const result = await q.query<T>(sql, params);
  if (config.isDevelopment) {
    const ms = Date.now() - startedAt;
    if (ms >= SLOW_QUERY_MS) {
      console.warn(`Slow query (${ms} ms): ${sql.replace(/\s+/g, ' ').trim().slice(0, 200)}`);
    }
  }
  return result.rows;
};

// zero or more rows
export const many = <T extends QueryResultRow>(q: Queryable, sql: string, params: unknown[] = []): Promise<T[]> =>
  run<T>(q, sql, params);

// zero or one row, use for lookups where "not found" is a normal outcome
export const maybeOne = async <T extends QueryResultRow>(q: Queryable, sql: string, params: unknown[] = []): Promise<T | null> => {
  const rows = await run<T>(q, sql, params);
  return rows[0] ?? null;
};

// exactly one row, use for insert ... returning and update ... returning where a
// missing row is a bug, not a user error
export const one = async <T extends QueryResultRow>(q: Queryable, sql: string, params: unknown[] = []): Promise<T> => {
  const rows = await run<T>(q, sql, params);
  if (rows.length !== 1) {
    throw new Error(`Expected exactly 1 row, got ${rows.length}: ${sql.slice(0, 120)}`);
  }
  return rows[0];
};

// statements where only the affected row count is needed (update, delete without returning)
export const execute = async (q: Queryable, sql: string, params: unknown[] = []): Promise<number> => {
  const result = await q.query(sql, params);
  return result.rowCount ?? 0;
};

export type IsolationLevel = 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

interface TransactionOptions {
  isolation?: IsolationLevel;
}

// runs fn inside begin ... commit on a dedicated client. any thrown error rolls back
// and is rethrown. the client is always released, even if rollback itself fails
//
// services own transactions. repositories never call this, they receive the tx
// as their queryable argument
export const withTransaction = async <T>(fn: (tx: PoolClient) => Promise<T>, opts: TransactionOptions = {}): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query(opts.isolation ? `BEGIN ISOLATION LEVEL ${opts.isolation}` : 'BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('ROLLBACK failed:', (rollbackErr as Error).message);
    }
    throw err;
  } finally {
    client.release();
  }
};