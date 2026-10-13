import type { AuthResponse, Category } from '@expense/shared';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

export const API = '/api/v1';

export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  setupApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
}

let counter = 0;

export interface TestUser {
  token: string;
  user: AuthResponse['user'];
  cookies: string[];
  categories: Category[];
  auth: { Authorization: string };
  email: string;
  password: string;
}

export async function registerUser(
  app: INestApplication,
  overrides: Partial<{ email: string; password: string; name: string; timezone: string }> = {},
): Promise<TestUser> {
  counter += 1;
  const email = overrides.email ?? `user${counter}-${Date.now()}@example.com`;
  const password = overrides.password ?? 'Passw0rd!';
  const res = await request(app.getHttpServer())
    .post(`${API}/auth/register`)
    .send({
      name: overrides.name ?? `User ${counter}`,
      email,
      password,
      timezone: overrides.timezone,
    })
    .expect(201);
  const body = res.body as AuthResponse;
  const auth = { Authorization: `Bearer ${body.accessToken}` };
  const categories = (
    await request(app.getHttpServer()).get(`${API}/categories`).set(auth).expect(200)
  ).body as Category[];
  return {
    token: body.accessToken,
    user: body.user,
    cookies: ([] as string[]).concat(res.headers['set-cookie'] ?? []),
    categories,
    auth,
    email,
    password,
  };
}

export function categoryId(user: TestUser, name: string): string {
  const found = user.categories.find((c) => c.name === name);
  if (!found) throw new Error(`No category ${name}`);
  return found.id;
}

/** Extracts "name=value" pairs from Set-Cookie headers for re-sending. */
export function cookieHeader(setCookies: string[], name: string): string {
  const cookie = setCookies.find((c) => c.startsWith(`${name}=`));
  if (!cookie) throw new Error(`Cookie ${name} not set`);
  return cookie.split(';')[0];
}
