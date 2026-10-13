/**
 * Integration tests: boot the full Nest application against a real PostgreSQL database
 * (DATABASE_URL from apps/api/.env.test, normally the expense_tracker_test database).
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.e2e-spec.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/global-setup.ts',
  setupFiles: ['<rootDir>/setup-env.ts'],
  testTimeout: 30000,
};
