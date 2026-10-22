import type { AuthResponse } from '@expense/shared';
import type { INestApplication } from '@nestjs/common';
import { createHash } from 'crypto';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service';
import type * as TestUtils from './utils';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';

/** An unsigned ID token: the API takes it straight from Google's token endpoint over TLS. */
function idToken(claims: Record<string, unknown>): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part({
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 3600,
    email_verified: true,
    ...claims,
  })}.signature`;
}

function cookieValue(setCookies: string[], name: string): string | undefined {
  return setCookies
    .find((c) => c.startsWith(`${name}=`))
    ?.split(';')[0]
    ?.slice(name.length + 1);
}

describe('Google sign-in (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let utils: typeof TestUtils;
  let fetchMock: jest.SpyInstance;
  let API: string;

  beforeAll(async () => {
    // Configuration is read when the app module loads, so set the keys before importing it.
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    utils = await import('./utils');
    API = utils.API;
    ({ app, prisma } = await utils.createTestApp());
    await utils.resetDatabase(prisma);
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    await app.close();
  });

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  /** Plays Google: the token endpoint answers with an ID token for `claims`. */
  const googleReturns = (claims: Record<string, unknown>) =>
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id_token: idToken(claims) }), { status: 200 }),
    );

  /** Starts sign-in, then returns from "Google" with an authorization code. */
  async function signIn(query: Record<string, string> = {}, overrides: { state?: string } = {}) {
    const start = await http.get(`${API}/auth/google`).query(query).expect(302);
    const location = new URL(start.headers.location as string);
    const startCookies = ([] as string[]).concat(start.headers['set-cookie'] ?? []);
    const flowCookie = cookieValue(startCookies, 'et_google')!;
    const callback = await http
      .get(`${API}/auth/google/callback`)
      .query({ code: 'auth-code', state: overrides.state ?? location.searchParams.get('state')! })
      .set('Cookie', `et_google=${flowCookie}`)
      .expect(200);
    return {
      location,
      startCookies,
      callback,
      cookies: ([] as string[]).concat(callback.headers['set-cookie'] ?? []),
    };
  }

  /** Exchanges the refresh cookie from a sign-in for an access token, as the web app does. */
  const sessionFrom = async (cookies: string[]) =>
    (
      await http
        .post(`${API}/auth/refresh`)
        .set('Cookie', `et_rt=${cookieValue(cookies, 'et_rt')}`)
        .set('x-csrf-protection', '1')
        .expect(200)
    ).body as AuthResponse;

  it('reports Google as available', async () => {
    await http.get(`${API}/auth/providers`).expect(200).expect({ google: true });
  });

  it('sends the browser to Google with PKCE and a state cookie', async () => {
    const res = await http.get(`${API}/auth/google`).query({ next: '/loans' }).expect(302);
    const url = new URL(res.headers.location as string);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toMatch(/\/api\/v1\/auth\/google\/callback$/);
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toHaveLength(43);

    const cookie = ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('et_google='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth\/google/);
  });

  it('creates an account on first sign-in and signs it in', async () => {
    googleReturns({ sub: 'google-new', email: 'New.Person@Gmail.com', name: 'New Person' });
    const { location, startCookies, callback, cookies } = await signIn({
      next: '/loans',
      tz: 'Asia/Dhaka',
    });

    // The code was exchanged with the verifier that matches the challenge sent to Google.
    const body = fetchMock.mock.calls[0]![1]!.body as URLSearchParams;
    const flow = JSON.parse(
      Buffer.from(cookieValue(startCookies, 'et_google')!, 'base64url').toString('utf8'),
    ) as { verifier: string };
    expect(body.get('code_verifier')).toBe(flow.verifier);
    expect(location.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(flow.verifier).digest('base64url'),
    );
    expect(body.get('client_secret')).toBe('test-secret');

    expect(callback.text).toContain('url=/loans');
    expect(cookieValue(cookies, 'et_rt')).toBeTruthy();
    expect(cookieValue(cookies, 'et_session')).toBe('1');

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'new.person@gmail.com' },
      include: { categories: true },
    });
    expect(user).toMatchObject({
      name: 'New Person',
      googleId: 'google-new',
      passwordHash: null,
      timezone: 'Asia/Dhaka',
      currency: 'BDT',
    });
    expect(user.categories.length).toBeGreaterThan(0);

    // The refresh cookie restores the session like any other sign-in.
    const refreshed = await sessionFrom(cookies);
    expect(refreshed.user).toMatchObject({ hasPassword: false, googleLinked: true });

    // Signing in again finds the same account.
    googleReturns({ sub: 'google-new', email: 'new.person@gmail.com', name: 'Renamed' });
    await signIn();
    expect(await prisma.user.count({ where: { googleId: 'google-new' } })).toBe(1);
  });

  it('links Google to an existing account with the same verified email', async () => {
    const existing = await utils.registerUser(app, { email: 'owner@example.com' });
    googleReturns({ sub: 'google-owner', email: 'owner@example.com', name: 'Someone' });
    const { cookies } = await signIn();
    expect(cookieValue(cookies, 'et_rt')).toBeTruthy();

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'owner@example.com' } });
    expect(user).toMatchObject({ googleId: 'google-owner', name: existing.user.name });
    expect(user.passwordHash).not.toBeNull();
    // The password still works alongside Google.
    await http
      .post(`${API}/auth/login`)
      .send({ email: 'owner@example.com', password: existing.password })
      .expect(200);

    // A different Google account claiming the same email is refused, not swapped in.
    googleReturns({ sub: 'google-intruder', email: 'owner@example.com' });
    const second = await signIn();
    expect(second.callback.text).toContain('reason=account_linked_elsewhere');
    expect(cookieValue(second.cookies, 'et_rt')).toBeUndefined();
  });

  it.each([
    [
      'an unverified email',
      { sub: 'g-unverified', email: 'x@example.com', email_verified: false },
      'unverified_email',
    ],
    [
      'a token for another app',
      { sub: 'g-aud', email: 'y@example.com', aud: 'someone-else' },
      'wrong_audience',
    ],
    ['an expired token', { sub: 'g-exp', email: 'z@example.com', exp: 1 }, 'expired_id_token'],
  ])('rejects %s', async (_label, claims, reason) => {
    googleReturns(claims);
    const { callback, cookies } = await signIn();
    expect(callback.text).toContain(`/login?error=google`);
    expect(callback.text).toContain(`reason=${reason}`);
    expect(cookieValue(cookies, 'et_rt')).toBeUndefined();
    expect(await prisma.user.count({ where: { googleId: claims.sub } })).toBe(0);
  });

  it('rejects a callback whose state does not match the cookie', async () => {
    googleReturns({ sub: 'g-state', email: 'state@example.com' });
    const { callback, cookies } = await signIn({}, { state: 'forged-state' });
    expect(callback.text).toContain('reason=state_mismatch');
    expect(cookieValue(cookies, 'et_rt')).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns to sign-in when the user cancels at Google', async () => {
    const res = await http
      .get(`${API}/auth/google/callback`)
      .query({ error: 'access_denied' })
      .expect(200);
    expect(res.text).toContain('reason=cancelled');
  });

  it('only continues to paths on this site', async () => {
    for (const next of ['//evil.example', 'https://evil.example', '/\\evil.example']) {
      googleReturns({ sub: 'g-next', email: 'next@example.com' });
      const { callback } = await signIn({ next });
      expect(callback.text).toContain('url=/dashboard');
    }
  });

  it('lets a Google-only account set a password and delete itself without one', async () => {
    googleReturns({ sub: 'g-settings', email: 'settings@example.com', name: 'Settings' });
    const { cookies } = await signIn();
    const session = await sessionFrom(cookies);
    const auth = { Authorization: `Bearer ${session.accessToken}` };

    // No password yet: changing the sign-in email is blocked, setting a password is not.
    await http
      .patch(`${API}/users/me`)
      .set(auth)
      .send({ email: 'changed@example.com' })
      .expect(400);
    const set = (
      await http
        .patch(`${API}/users/me/password`)
        .set(auth)
        .send({ newPassword: 'NewPassw0rd' })
        .expect(200)
    ).body as AuthResponse;
    expect(set.user.hasPassword).toBe(true);
    await http
      .post(`${API}/auth/login`)
      .send({ email: 'settings@example.com', password: 'NewPassw0rd' })
      .expect(200);

    // Another Google-only account deletes itself with just the typed confirmation.
    googleReturns({ sub: 'g-delete', email: 'delete@example.com' });
    const deletion = await signIn();
    const other = await sessionFrom(deletion.cookies);
    await http
      .delete(`${API}/users/me`)
      .set({ Authorization: `Bearer ${other.accessToken}` })
      .send({ confirmation: 'DELETE' })
      .expect(204);
    expect(await prisma.user.count({ where: { googleId: 'g-delete' } })).toBe(0);
  });

  it('never lets a password sign in to an account that has none', async () => {
    googleReturns({ sub: 'g-nopass', email: 'nopass@example.com' });
    await signIn();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'nopass@example.com' } });
    expect(user.passwordHash).toBeNull();
    await http
      .post(`${API}/auth/login`)
      .send({ email: 'nopass@example.com', password: 'anything1' })
      .expect(401);
  });
});
