import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../src/config/config';

const valid = () => ({ DATABASE_URL: 'postgresql://test:test@127.0.0.1/lab_test', JWT_SECRET: randomBytes(32).toString('hex') });

test('mounted credentials load without ambiguous sources or secret-bearing errors', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lab-secret-test-'));
  try {
    const data = valid();
    const database = join(directory, 'database');
    const jwt = join(directory, 'jwt');
    writeFileSync(database, data.DATABASE_URL + '\n', { mode: 0o600 });
    writeFileSync(jwt, data.JWT_SECRET + '\n', { mode: 0o600 });
    const config = loadConfig({ DATABASE_URL_FILE: database, JWT_SECRET_FILE: jwt });
    assert.equal(config.databaseUrl, data.DATABASE_URL);
    assert.equal(config.jwtSecret, data.JWT_SECRET);
    assert.throws(() => loadConfig({ ...data, JWT_SECRET_FILE: jwt }), /either a value or a mounted file/);
    assert.throws(() => loadConfig({ DATABASE_URL_FILE: database, JWT_SECRET_FILE: join(directory, 'absent') }),
      (error: unknown) => error instanceof Error && /JWT_SECRET_FILE/.test(error.message) && !error.message.includes(directory));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('configuration rejects absent and placeholder secrets', () => {
  assert.throws(() => loadConfig({ DATABASE_URL: valid().DATABASE_URL }), /JWT_SECRET/);
  assert.throws(() => loadConfig({ ...valid(), JWT_SECRET: 'replace-with-at-least-32-random-bytes' }), /JWT_SECRET/);
});

test('configuration validates database, port, token lifetime, and documentation switch', () => {
  assert.throws(() => loadConfig({ ...valid(), DATABASE_URL: 'https://example.test' }), /DATABASE_URL/);
  assert.throws(() => loadConfig({ ...valid(), PORT: '0' }), /PORT/);
  assert.throws(() => loadConfig({ ...valid(), JWT_TTL_SECONDS: '86400' }), /JWT_TTL_SECONDS/);
  assert.throws(() => loadConfig({ ...valid(), DOCS_ENABLED: 'yes' }), /DOCS_ENABLED/);
  const config = loadConfig(valid());
  assert.equal(config.port, 3000);
  assert.equal(config.jwtTtlSeconds, 900);
  assert.equal(config.docsEnabled, false);
});
