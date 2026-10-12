import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

if (process.env.CI_TEST_DB_HOST) {
  await import('./test-ci-database.mjs');
} else {
const project = `devsecops-test-${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('hex');
const appPassword = randomBytes(24).toString('hex');
const env = { ...process.env, TEST_DB_PASSWORD: password, TEST_APP_DB_PASSWORD: appPassword };
const compose = ['compose', '--file', 'compose.test.yaml', '--project-name', project];
let child;
let started = false;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { env, stdio: 'inherit', ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} failed; exit status ${result.status}`);
  return result;
}

function cleanup() {
  if (!started) return;
  const result = spawnSync('docker', [...compose, 'down', '--volumes', '--remove-orphans'], { env, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(`Test cleanup failed. Remove the isolated Compose project ${project}.`);
    process.exitCode = 1;
  }
  started = false;
}

process.on('SIGINT', () => { child?.kill('SIGINT'); cleanup(); process.exit(130); });
process.on('SIGTERM', () => { child?.kill('SIGTERM'); cleanup(); process.exit(143); });

try {
  started = true;
  run('docker', [...compose, 'up', '--detach', '--wait', '--wait-timeout', '120']);
  const output = run('docker', [...compose, 'port', 'db', '5432'], { stdio: 'pipe', encoding: 'utf8' }).stdout.trim();
  const port = output.match(/^127\.0\.0\.1:(\d+)$/)?.[1];
  if (!port) throw new Error('Could not discover the isolated database port');
  env.TEST_DATABASE_URL = `postgresql://lab_app_user:${appPassword}@127.0.0.1:${port}/lab_test`;
  env.TEST_MIGRATION_DATABASE_URL = `postgresql://lab_test:${password}@127.0.0.1:${port}/lab_test`;
  const status = await new Promise((resolve, reject) => {
    child = spawn('npm', ['run', 'test:e2e'], { env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  process.exitCode = status;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  cleanup();
}
}
