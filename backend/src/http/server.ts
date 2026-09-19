// backend/src/http/server.ts

import http from 'http';
import { Express } from 'express';
import { config, describeConfig } from '../config';
import { closePool, testConnection } from '../db';

const SHUTDOWN_TIMEOUT_MS = 10_000;

export const startServer = async (app: Express): Promise<http.Server> => {
  if (!(await testConnection())) {
    console.error('FATAL: database unreachable at startup');
    process.exit(1);
  }

  const server = http.createServer(app);
  // keep alive slightly above typical ingress idle timeouts to avoid 502s on reuse
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  await new Promise<void>(resolve => server.listen(config.http.port, resolve));
  console.log(JSON.stringify({ level: 'info', msg: 'server_started', ...describeConfig() }));

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ level: 'info', msg: 'shutdown_started', signal }));

    // stop accepting new connections, let in flight requests finish, then close the pool
    const forceExit = setTimeout(() => {
      console.error('Shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    server.close(async () => {
      try {
        await closePool();
        clearTimeout(forceExit);
        console.log(JSON.stringify({ level: 'info', msg: 'shutdown_complete' }));
        process.exit(0);
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', reason => {
    console.error(JSON.stringify({ level: 'error', msg: 'unhandled_rejection', reason: String(reason) }));
  });

  return server;
};