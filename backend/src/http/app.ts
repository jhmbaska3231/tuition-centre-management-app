// backend/src/http/app.ts
//
// builds the express application, domain modules are mounted through the routers
// argument so this file never imports business code

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import promClient from 'prom-client';
import { config } from '../config';
import { testConnection } from '../db';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { generalLimiter } from './middleware/rate-limit';
import { requestContext } from './middleware/request-context';

export interface MountedRouter {
  path: string;
  router: Router;
}

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
});
promClient.collectDefaultMetrics();

export const createApp = (routers: MountedRouter[]) => {
  const app = express();

  // 1. proxy awareness. must come first: req.ip, rate limiting and secure cookies depend on it
  app.set('trust proxy', config.http.trustProxyHops);
  app.disable('x-powered-by');

  // 2. security headers. this is a json api, so csp and other document only headers
  //    are disabled here and belong on the frontend nginx instead
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  }));

  // 3. request id and access logging
  app.use(requestContext);

  // 4. probes and metrics. outside cors and rate limiting, restrict at the ingress
  //    so /metrics is reachable only from inside the cluster
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/ready', async (_req, res) => {
    const ok = await testConnection();
    res.status(ok ? 200 : 503).json({ status: ok ? 'ready' : 'not_ready', database: ok ? 'connected' : 'unreachable' });
  });
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.send(await promClient.register.metrics());
  });

  // 5. cors. credentials: true is required for the refresh cookie
  app.use(cors({
    origin: config.http.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86_400,
  }));

  // 6. parsers. 1 mb should be enough for any json this api accepts
  // webhooks need the raw bytes for signature verification. body parser skips a body
  // that has already been read, so express.json below leaves this path alone
  app.use('/api/billing/webhooks', express.raw({ type: '*/*', limit: '1mb' }));
  app.use(express.json({ limit: '1mb', strict: true }));
  app.use(cookieParser());

  // 7. request metrics by matched route, not raw url, to keep label cardinality bounded
  app.use((req, res, next) => {
    res.on('finish', () => {
      const route = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
      httpRequestsTotal.inc({ method: req.method, route, status: String(res.statusCode) });
    });
    next();
  });

  // 8. rate limit and mount the api
  app.use('/api', generalLimiter);
  for (const { path, router } of routers) {
    app.use(path, router);
  }

  // 9. fallthrough and error contract
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};