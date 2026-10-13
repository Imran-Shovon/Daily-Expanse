import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { REFRESH_COOKIE, SESSION_HINT_COOKIE } from '../src/auth/auth.cookies';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { API, cookieHeader, createTestApp, registerUser, resetDatabase } from './utils';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('registration', () => {
    it('creates the user, seeds default categories and sets secure cookies', async () => {
      const res = await http
        .post(`${API}/auth/register`)
        .send({
          name: 'Ada',
          email: 'Ada@Example.com',
          password: 'Passw0rd!',
          timezone: 'Asia/Dhaka',
        })
        .expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ email: 'ada@example.com', timezone: 'Asia/Dhaka' });
      expect(res.body.user.passwordHash).toBeUndefined();

      const cookies: string[] = ([] as string[]).concat(res.headers['set-cookie']);
      const refresh = cookies.find((c) => c.startsWith(`${REFRESH_COOKIE}=`))!;
      expect(refresh).toMatch(/HttpOnly/i);
      expect(refresh).toMatch(/SameSite=Strict/i);
      expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
      expect(cookies.some((c) => c.startsWith(`${SESSION_HINT_COOKIE}=1`))).toBe(true);

      const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'ada@example.com' } });
      expect(stored.passwordHash).not.toContain('Passw0rd');
      expect(await prisma.category.count({ where: { userId: stored.id } })).toBe(18);
    });

    it('rejects a duplicate email', async () => {
      await http
        .post(`${API}/auth/register`)
        .send({ name: 'Ada', email: 'ada@example.com', password: 'Passw0rd!' })
        .expect(409);
    });

    it('validates input and rejects unknown fields', async () => {
      const weak = await http
        .post(`${API}/auth/register`)
        .send({ name: 'X', email: 'x@example.com', password: 'short' })
        .expect(400);
      expect(weak.body.message).toBe('Validation failed');
      expect(weak.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'password' })]),
      );

      await http
        .post(`${API}/auth/register`)
        .send({ name: 'X', email: 'not-an-email', password: 'Passw0rd!' })
        .expect(400);

      await http
        .post(`${API}/auth/register`)
        .send({ name: 'X', email: 'x2@example.com', password: 'Passw0rd!', isAdmin: true })
        .expect(400);
    });
  });

  describe('login and guards', () => {
    it('logs in with valid credentials only', async () => {
      await registerUser(app, { email: 'login@example.com', password: 'Passw0rd!' });
      const ok = await http
        .post(`${API}/auth/login`)
        .send({ email: 'LOGIN@example.com', password: 'Passw0rd!' })
        .expect(200);
      expect(ok.body.user.email).toBe('login@example.com');

      const wrong = await http
        .post(`${API}/auth/login`)
        .send({ email: 'login@example.com', password: 'wrong-pass1' })
        .expect(401);
      const unknown = await http
        .post(`${API}/auth/login`)
        .send({ email: 'nobody@example.com', password: 'wrong-pass1' })
        .expect(401);
      // Same message for both so accounts cannot be enumerated.
      expect(wrong.body.message).toBe(unknown.body.message);
    });

    it('requires a valid bearer token on protected routes', async () => {
      await http.get(`${API}/auth/me`).expect(401);
      await http.get(`${API}/transactions`).set('Authorization', 'Bearer not-a-token').expect(401);
      await http.get(`${API}/dashboard/summary`).set('Authorization', 'Basic abc').expect(401);

      const user = await registerUser(app);
      const me = await http.get(`${API}/auth/me`).set(user.auth).expect(200);
      expect(me.body.id).toBe(user.user.id);
    });

    it('keeps public routes open', async () => {
      await http.get(`${API}/health`).expect(200);
    });
  });

  describe('refresh tokens', () => {
    it('requires the CSRF header', async () => {
      const user = await registerUser(app);
      await http
        .post(`${API}/auth/refresh`)
        .set('Cookie', cookieHeader(user.cookies, REFRESH_COOKIE))
        .expect(403);
    });

    it('rotates the refresh token on every use', async () => {
      const user = await registerUser(app);
      const first = cookieHeader(user.cookies, REFRESH_COOKIE);

      const res = await http
        .post(`${API}/auth/refresh`)
        .set('Cookie', first)
        .set('x-csrf-protection', '1')
        .expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      const second = cookieHeader(
        ([] as string[]).concat(res.headers['set-cookie']),
        REFRESH_COOKIE,
      );
      expect(second).not.toBe(first);

      // Within the grace window a just-rotated token still yields a session (the new cookie may
      // never have reached the browser), without revoking the family.
      await http
        .post(`${API}/auth/refresh`)
        .set('Cookie', first)
        .set('x-csrf-protection', '1')
        .expect(200);
      await http
        .post(`${API}/auth/refresh`)
        .set('Cookie', second)
        .set('x-csrf-protection', '1')
        .expect(200);
    });

    it('revokes the whole token family when a rotated token is replayed later', async () => {
      const user = await registerUser(app);
      const stolen = cookieHeader(user.cookies, REFRESH_COOKIE);
      const res = await http
        .post(`${API}/auth/refresh`)
        .set('Cookie', stolen)
        .set('x-csrf-protection', '1')
        .expect(200);
      const current = cookieHeader(
        ([] as string[]).concat(res.headers['set-cookie']),
        REFRESH_COOKIE,
      );

      // Simulate the replay happening well after rotation.
      await prisma.refreshToken.updateMany({
        where: { userId: user.user.id, revokedAt: { not: null } },
        data: { revokedAt: new Date(Date.now() - 60_000) },
      });
      await http
        .post(`${API}/auth/refresh`)
        .set('Cookie', stolen)
        .set('x-csrf-protection', '1')
        .expect(401);
      // The legitimate holder's newer token is now revoked too.
      await http
        .post(`${API}/auth/refresh`)
        .set('Cookie', current)
        .set('x-csrf-protection', '1')
        .expect(401);
    });

    it('logout revokes the refresh token and clears cookies', async () => {
      const user = await registerUser(app);
      const cookie = cookieHeader(user.cookies, REFRESH_COOKIE);
      const res = await http
        .post(`${API}/auth/logout`)
        .set('Cookie', cookie)
        .set('x-csrf-protection', '1')
        .expect(204);
      expect(([] as string[]).concat(res.headers['set-cookie']).join(';')).toMatch(
        new RegExp(`${REFRESH_COOKIE}=;`),
      );
      await http
        .post(`${API}/auth/refresh`)
        .set('Cookie', cookie)
        .set('x-csrf-protection', '1')
        .expect(401);
    });
  });

  describe('password reset', () => {
    it('emails a single-use reset link and signs out other sessions', async () => {
      const mail = app.get(MailService);
      const user = await registerUser(app, { email: 'reset@example.com' });

      const unknown = await http
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'missing@example.com' })
        .expect(200);
      const known = await http
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'reset@example.com' })
        .expect(200);
      expect(known.body.message).toBe(unknown.body.message);

      const message = mail.outbox.find((m) => m.to === 'reset@example.com');
      const token = /token=([\w-]+)/.exec(message!.text)![1];

      await http
        .post(`${API}/auth/reset-password`)
        .send({ token, password: 'NewPassw0rd' })
        .expect(200);
      await http
        .post(`${API}/auth/reset-password`)
        .send({ token, password: 'Another1pass' })
        .expect(400);

      await http
        .post(`${API}/auth/login`)
        .send({ email: 'reset@example.com', password: user.password })
        .expect(401);
      await http
        .post(`${API}/auth/login`)
        .send({ email: 'reset@example.com', password: 'NewPassw0rd' })
        .expect(200);
      await http
        .post(`${API}/auth/refresh`)
        .set('Cookie', cookieHeader(user.cookies, REFRESH_COOKIE))
        .set('x-csrf-protection', '1')
        .expect(401);
    });

    it('rejects an expired token', async () => {
      const mail = app.get(MailService);
      await registerUser(app, { email: 'expired@example.com' });
      await http
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'expired@example.com' })
        .expect(200);
      const message = [...mail.outbox].reverse().find((m) => m.to === 'expired@example.com');
      const token = /token=([\w-]+)/.exec(message!.text)![1];
      await prisma.passwordResetToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await http
        .post(`${API}/auth/reset-password`)
        .send({ token, password: 'NewPassw0rd' })
        .expect(400);
    });
  });

  describe('account management', () => {
    it('updates preferences and validates the time zone', async () => {
      const user = await registerUser(app);
      const res = await http
        .patch(`${API}/users/me`)
        .set(user.auth)
        .send({ currency: 'BDT', timezone: 'Asia/Dhaka', theme: 'dark', dateFormat: 'dd/MM/yyyy' })
        .expect(200);
      expect(res.body).toMatchObject({ currency: 'BDT', timezone: 'Asia/Dhaka', theme: 'dark' });
      await http
        .patch(`${API}/users/me`)
        .set(user.auth)
        .send({ timezone: 'Mars/Base' })
        .expect(400);
    });

    it('requires the current password to change email', async () => {
      const user = await registerUser(app);
      await http
        .patch(`${API}/users/me`)
        .set(user.auth)
        .send({ email: 'new@example.com' })
        .expect(400);
      await http
        .patch(`${API}/users/me`)
        .set(user.auth)
        .send({ email: 'new@example.com', currentPassword: 'wrong' })
        .expect(401);
      await http
        .patch(`${API}/users/me`)
        .set(user.auth)
        .send({ email: 'new@example.com', currentPassword: user.password })
        .expect(200);
    });

    it('changes the password and revokes old sessions', async () => {
      const user = await registerUser(app);
      await http
        .patch(`${API}/users/me/password`)
        .set(user.auth)
        .send({ currentPassword: 'wrong-pass1', newPassword: 'Changed1pass' })
        .expect(401);
      await http
        .patch(`${API}/users/me/password`)
        .set(user.auth)
        .send({ currentPassword: user.password, newPassword: 'Changed1pass' })
        .expect(200);
      await http
        .post(`${API}/auth/refresh`)
        .set('Cookie', cookieHeader(user.cookies, REFRESH_COOKIE))
        .set('x-csrf-protection', '1')
        .expect(401);
      await http
        .post(`${API}/auth/login`)
        .send({ email: user.email, password: 'Changed1pass' })
        .expect(200);
    });

    it('deletes the account and all data after confirmation', async () => {
      const user = await registerUser(app);
      await http
        .delete(`${API}/users/me`)
        .set(user.auth)
        .send({ password: user.password, confirmation: 'delete' })
        .expect(400);
      await http
        .delete(`${API}/users/me`)
        .set(user.auth)
        .send({ password: 'wrong', confirmation: 'DELETE' })
        .expect(401);
      await http
        .delete(`${API}/users/me`)
        .set(user.auth)
        .send({ password: user.password, confirmation: 'DELETE' })
        .expect(204);
      expect(await prisma.user.count({ where: { id: user.user.id } })).toBe(0);
      expect(await prisma.category.count({ where: { userId: user.user.id } })).toBe(0);
    });
  });
});
