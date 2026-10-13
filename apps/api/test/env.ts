import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** Minimal .env parser (KEY=value, # comments) so tests need no extra dependency. */
export function loadTestEnv(): Record<string, string> {
  const root = join(__dirname, '..');
  const values: Record<string, string> = {};
  for (const file of ['.env', '.env.test']) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
  values.NODE_ENV = 'test';
  values.RECURRING_SCHEDULER_ENABLED = 'false';
  if (!values.DATABASE_URL?.includes('test')) {
    throw new Error(
      'Refusing to run integration tests: DATABASE_URL in .env.test must point at a test database',
    );
  }
  return values;
}
