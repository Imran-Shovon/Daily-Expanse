import type { CookieOptions, Response } from 'express';

/** httpOnly refresh token, only ever sent to the auth endpoints. */
export const REFRESH_COOKIE = 'et_rt';
/**
 * Non-sensitive hint cookie ("1") readable by the Next.js server so it can redirect
 * signed-out visitors before rendering. It grants no access by itself.
 */
export const SESSION_HINT_COOKIE = 'et_session';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function setAuthCookies(res: Response, token: string, expires: Date, secure: boolean) {
  const base: CookieOptions = { secure, sameSite: 'strict', expires };
  res.cookie(REFRESH_COOKIE, token, { ...base, httpOnly: true, path: REFRESH_COOKIE_PATH });
  res.cookie(SESSION_HINT_COOKIE, '1', { ...base, httpOnly: false, path: '/' });
}

export function clearAuthCookies(res: Response, secure: boolean) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  });
  res.clearCookie(SESSION_HINT_COOKIE, { secure, sameSite: 'strict', path: '/' });
}
