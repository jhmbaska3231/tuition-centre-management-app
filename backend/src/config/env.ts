// backend/src/config/env.ts
//
// single source of truth for environment configuration
// import { config } from this module, do not read process.env anywhere else

import dotenv from 'dotenv';
import { z } from 'zod';

// loads backend/.env in local development, harmless in kubernetes where no file exists
// and values come from the pod spec
dotenv.config();

// matches the ms package's stringvalue type that jsonwebtoken expects for expiresin
type JwtDuration = `${number}` | `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`;
const jwtDuration = z.string()
  .regex(/^\d+(ms|s|m|h|d)?$/, 'Expected a duration like 15m, 12h or 7d')
  .transform(v => v as JwtDuration);

const hex32Bytes = z.string().regex(/^[0-9a-fA-F]{64}$/, 'Expected 64 hex characters (32 bytes)');

const schema = z.object({
  // runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // number of reverse proxies between the client and this process
  // 0 for local dev, 1 for a single ingress controller. see express "trust proxy"
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),

  // database
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),
  DB_SSL: z.enum(['disable', 'require', 'verify-full']).default('disable'),

  // auth: short lived access token (jwt) + rotating refresh token in an httponly cookie
  ACCESS_TOKEN_SECRET: z.string().min(32, 'Must be at least 32 characters'),
  ACCESS_TOKEN_TTL: jwtDuration.default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  REFRESH_COOKIE_NAME: z.string().min(1).default('rt'),
  // cookie secure flag, must be true in production (enforced below)
  COOKIE_SECURE: z.stringbool().default(false),

  // aes-256-gcm key for org_integrations.config_encrypted
  APP_ENCRYPTION_KEY: hex32Bytes,

  // cors allowlist, comma separated. in development http://localhost:5173 is always added
  FRONTEND_URLS: z.string().min(1).transform(s => s.split(',').map(u => u.trim()).filter(Boolean)),

  // rate limiting
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
  RATE_LIMIT_GENERAL_MAX: z.coerce.number().int().min(1).default(300),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(10),
})
  // cross field rules that only make sense together
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (!env.COOKIE_SECURE) {
        ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'Must be true in production' });
      }
      if (env.DB_SSL === 'disable') {
        ctx.addIssue({ code: 'custom', path: ['DB_SSL'], message: 'Must be require or verify-full in production' });
      }
      if (env.FRONTEND_URLS.some(u => !u.startsWith('https://'))) {
        ctx.addIssue({ code: 'custom', path: ['FRONTEND_URLS'], message: 'All origins must use https in production' });
      }
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map(i => `  ${i.path.join('.') || '(root)'}: ${i.message}`);
  console.error('FATAL: Invalid environment configuration\n' + lines.join('\n'));
  process.exit(1);
}

const env = parsed.data;

// derived, typed, ready to use, group by concern so call sites read naturally:
// config.db.host, config.auth.accesstokenttl, config.http.corsorigins
export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  logLevel: env.LOG_LEVEL,

  http: {
    port: env.PORT,
    trustProxyHops: env.TRUST_PROXY_HOPS,
    corsOrigins: env.NODE_ENV === 'development'
      ? Array.from(new Set([...env.FRONTEND_URLS, 'http://localhost:5173']))
      : env.FRONTEND_URLS,
    rateLimit: {
      windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
      generalMax: env.RATE_LIMIT_GENERAL_MAX,
      authMax: env.RATE_LIMIT_AUTH_MAX,
    },
  },

  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    poolMax: env.DB_POOL_MAX,
    ssl: env.DB_SSL === 'disable'
      ? false
      : { rejectUnauthorized: env.DB_SSL === 'verify-full' },
  },

  auth: {
    accessTokenSecret: env.ACCESS_TOKEN_SECRET,
    accessTokenTtl: env.ACCESS_TOKEN_TTL,
    refreshTokenTtlMs: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    refreshCookie: {
      name: env.REFRESH_COOKIE_NAME,
      secure: env.COOKIE_SECURE,
      // refresh cookie is only ever sent to the refresh and logout endpoints
      path: '/api/auth',
      sameSite: 'strict' as const,
      httpOnly: true,
    },
  },

  crypto: {
    encryptionKey: Buffer.from(env.APP_ENCRYPTION_KEY, 'hex'),
  },
} as const;

export type Config = typeof config;

// safe to log at startup, secrets are deliberately excluded
export const describeConfig = () => ({
  env: config.env,
  port: config.http.port,
  trustProxyHops: config.http.trustProxyHops,
  corsOrigins: config.http.corsOrigins,
  db: { host: config.db.host, port: config.db.port, database: config.db.database, ssl: config.db.ssl !== false },
  accessTokenTtl: config.auth.accessTokenTtl,
  refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
});