import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const password = randomBytes(24).toString('hex');
const appPassword = randomBytes(24).toString('hex');
const secret = randomBytes(32).toString('hex');
const content = [
  'NODE_ENV=development',
  'PORT=3000',
  'POSTGRES_USER=lab_admin',
  'POSTGRES_DB=lab_app',
  `POSTGRES_PASSWORD=${password}`,
  `APP_DB_PASSWORD=${appPassword}`,
  `DATABASE_URL=postgresql://lab_app_user:${appPassword}@127.0.0.1:15432/lab_app`,
  `MIGRATION_DATABASE_URL=postgresql://lab_admin:${password}@127.0.0.1:15432/lab_app`,
  `JWT_SECRET=${secret}`,
  'JWT_TTL_SECONDS=900',
  'DOCS_ENABLED=true',
  '',
].join('\n');

try {
  writeFileSync('.env', content, { flag: 'wx', mode: 0o600 });
  console.log('Created .env with random database and JWT secrets.');
} catch (error) {
  if (error.code === 'EEXIST') {
    console.log('.env already exists; configuration was preserved.');
  } else {
    throw error;
  }
}
