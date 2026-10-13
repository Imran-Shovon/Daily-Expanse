import type { ApiErrorBody, AuthResponse } from '@expense/shared';

/**
 * Typed fetch wrapper for the API.
 *
 * - The browser calls the same-origin `/api/v1` path, which Next.js proxies to the API.
 * - The access token lives only in memory (never localStorage), so XSS cannot read a
 *   long-lived credential. The refresh token is an httpOnly cookie the browser sends to
 *   /api/v1/auth only.
 * - On a 401 the client refreshes once and retries. Concurrent 401s share one refresh
 *   (single flight), and refreshes are serialised across tabs with the Web Locks API, so
 *   rotating refresh tokens never race each other into a logout loop.
 */

export const API_BASE = '/api/v1';
export const CSRF_HEADER = 'x-csrf-protection';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level validation messages keyed by field name. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const item of this.details as { field?: string; errors?: string[] }[]) {
      if (item.field && item.errors?.length) out[item.field] = item.errors[0]!;
    }
    return out;
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<AuthResponse | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

async function doRefresh(): Promise<AuthResponse | null> {
  const run = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { [CSRF_HEADER]: '1' },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as AuthResponse;
      accessToken = body.accessToken;
      return body;
    } catch {
      return null;
    }
  };
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('expense-tracker-refresh', run);
  }
  return run();
}

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<AuthResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Attach the bearer token and handle 401 with a refresh (default true). */
  auth?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
    signal: options.signal,
  });
}

async function toError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // non-JSON error (e.g. proxy failure)
  }
  const fallback =
    res.status >= 500
      ? 'Something went wrong on our side. Please try again.'
      : `Request failed (${res.status})`;
  return new ApiError(res.status, body?.message ?? fallback, body?.details);
}

/** Performs a request and returns the raw Response (used for file downloads). */
export async function apiRaw(path: string, options: RequestOptions = {}): Promise<Response> {
  let res: Response;
  try {
    res = await send(path, options);
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  if (res.status === 401 && options.auth !== false) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await send(path, options);
    }
    if (!refreshed || res.status === 401) {
      accessToken = null;
      onSessionExpired?.();
      throw new ApiError(401, 'Your session has expired. Please sign in again.');
    }
  }

  if (!res.ok) throw await toError(res);
  return res;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await apiRaw(path, options);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
