import { execSync } from 'child_process';
import { join } from 'path';
import { loadTestEnv } from './env';

/** Applies migrations to the test database once before the suite. */
export default function globalSetup() {
  const env = loadTestEnv();
  execSync('npx prisma migrate deploy', {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
    stdio: 'pipe',
  });
}
