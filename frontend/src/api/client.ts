// frontend/src/api/client.ts
//
// the single entry point for every request to the api:
// 1. single flight refresh. when ten queries fire at once on a dashboard and the access
//    token has expired, all ten get a 401. without coordination they would each post to
//    /auth/refresh, and because the backend rotates the refresh token and treats reuse
//    as theft, the second through tenth would present an already replaced token and
//    revoke the whole session family. sharing one in flight promise means one refresh
// 2. credentials: 'include' on every request, so the refresh cookie is sent. the dev
//    server proxies /api to the backend, so this is same origin in development too

import type { ApiErrorBody, SessionResponse } from '@tuition/shared';
import { ApiError, NetworkError } from './errors';
import { getAccessToken, setAccessToken } from './token-store';

const BASE = '/api';

// endpoints that must never trigger the refresh and retry path. refreshing in response
// to a failed login would be nonsense, and refreshing in response to a failed refresh
// would recurse
const NO_RETRY = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

let refreshPromise: Promise<string | null> | null = null;

const performRefresh = (): Promise<string | null> => {
  if (refreshPromise) return refreshPromise;

  const promise = (async (): Promise<string | null> => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      const body = (await res.json()) as SessionResponse;
      setAccessToken(body.accessToken);
      return body.accessToken;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  refreshPromise = promise;
  return promise;
};

// bootstrap on page load: exchange the refresh cookie for an access token, or return
// null if there is no valid session
export const bootstrapSession = async (): Promise<SessionResponse | null> => {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!res.ok) return null;
    const body = (await res.json()) as SessionResponse;
    setAccessToken(body.accessToken);
    return body;
  } catch {
    return null;
  }
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

const buildUrl = (path: string, query?: RequestOptions['query']): string => {
  if (!query) return `${BASE}${path}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${BASE}${path}?${qs}` : `${BASE}${path}`;
};

const send = async (path: string, opts: RequestOptions, token: string | null): Promise<Response> => {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    return await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      credentials: 'include',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new NetworkError(err);
  }
};

const toApiError = async (res: Response): Promise<ApiError> => {
  const requestId = res.headers.get('X-Request-Id') ?? 'unknown';
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiError(res.status, body.error.code, body.error.message, body.error.requestId ?? requestId, body.error.details);
  } catch {
    // a proxy or gateway error that never reached the api, so no structured body
    return new ApiError(res.status, 'internal_error', `Request failed with status ${res.status}`, requestId);
  }
};

export const request = async <T>(path: string, opts: RequestOptions = {}): Promise<T> => {
  let res = await send(path, opts, getAccessToken());

  // one refresh and retry on 401, except on the auth endpoints themselves
  if (res.status === 401 && !NO_RETRY.some(p => path.startsWith(p))) {
    const token = await performRefresh();
    if (token) res = await send(path, opts, token);
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
};

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
};