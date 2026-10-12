import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

// This service is dedicated to serialized CI tests and holds no application data.
if (process.env.CI_TEST_DB_HOST !== 'ci-db') throw new Error('Only the dedicated ci-db service can be reset');
const adminPassword = readFileSync(process.env.CI_TEST_DB_ADMIN_FILE, 'utf8').trim();
const appPassword = readFileSync(process.env.CI_TEST_DB_APP_FILE, 'utf8').trim();
const adminUrl = `postgresql://lab_test:${encodeURIComponent(adminPassword)}@ci-db:5432/lab_test`;
const appUrl = `postgresql://lab_app_user:${encodeURIComponent(appPassword)}@ci-db:5432/lab_test`;
const pool = new pg.Pool({ connectionString: adminUrl, max: 1 });
let child;
const reset = () => pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION lab_test;');
process.on('SIGINT', () => child?.kill('SIGINT'));
process.on('SIGTERM', () => child?.kill('SIGTERM'));
try {
  await reset();
  process.exitCode = await new Promise((resolve, reject) => {
    child = spawn('npm', ['run', 'test:e2e'], {
      stdio: 'inherit',
      env: { ...process.env, TEST_DATABASE_URL: appUrl, TEST_MIGRATION_DATABASE_URL: adminUrl,
        JWT_SECRET: randomBytes(48).toString('hex') },
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
} finally {
  await reset();
  await pool.end();
}
