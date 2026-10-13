import { NextResponse, type NextRequest } from 'next/server';

/**
 * Fast redirect for signed-out visitors before any app page renders. The `et_session` cookie
 * is only a hint set alongside the httpOnly refresh token; real authorization is enforced by
 * the API on every request.
 */
const PROTECTED = [
  '/dashboard',
  '/transactions',
  '/budgets',
  '/categories',
  '/reports',
  '/recurring',
  '/settings',
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && request.cookies.get('et_session')?.value !== '1') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
