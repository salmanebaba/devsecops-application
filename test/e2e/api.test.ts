import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { APP_CONFIG, JWT_AUDIENCE, JWT_ISSUER, loadConfig } from '../../src/config/config';
import { DatabaseService } from '../../src/database/database.service';
import { readMigrations, runMigrations } from '../../src/database/migrations';
import { setupApplication } from '../../src/setup';

const databaseUrl = process.env.TEST_DATABASE_URL;
const migrationUrl = process.env.TEST_MIGRATION_DATABASE_URL;
if (!databaseUrl || !migrationUrl || new URL(databaseUrl).pathname !== '/lab_test' || new URL(migrationUrl).pathname !== '/lab_test') {
  throw new Error('TEST_DATABASE_URL must point to an isolated database named lab_test. Use npm run test:integration.');
}
const config = loadConfig({ DATABASE_URL: databaseUrl, JWT_SECRET: randomBytes(32).toString('hex'), DOCS_ENABLED: 'true' });
const password = `${randomUUID()}-test-only`;
let app: INestApplication;
let database: DatabaseService;
let ownerId: string;
let ownerToken: string;
let otherToken: string;
let taskId: string;
const admin = new Pool({ connectionString: migrationUrl });

before(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(APP_CONFIG).useValue(config).compile();
  app = module.createNestApplication({ bodyParser: false, logger: false });
  setupApplication(app, config);
  await app.init();
  database = app.get(DatabaseService);
});
after(async () => { if (app) await app.close(); await admin.end(); });

test('liveness works before migrations; readiness requires the expected schema', async () => {
  await request(app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' });
  await request(app.getHttpServer()).get('/health/ready').expect(503);
  assert.deepEqual(await runMigrations(migrationUrl), ['001_initial.sql']);
  assert.deepEqual(await runMigrations(migrationUrl), []);
  await request(app.getHttpServer()).get('/health/ready').expect(200, { status: 'ok', database: 'ready' });
});

test('registration validates credentials and rejects unknown input fields', async () => {
  for (const body of [
    { email: 'bad-email', password },
    { email: 'test@lab.test', password: 'short' },
    { email: 'test@lab.test', password, role: 'admin' },
    { email: null, password },
  ]) {
    const response = await request(app.getHttpServer()).post('/v1/auth/register').send(body).expect(400);
    assert.ok(!response.text.includes(password));
  }
});

test('accounts persist salted hashes; responses omit credentials and duplicates conflict', async () => {
  const owner = await request(app.getHttpServer()).post('/v1/auth/register').send({ email: ' Owner@lab.test ', password }).expect(201);
  ownerId = owner.body.id;
  assert.equal(owner.body.email, 'owner@lab.test');
  assert.deepEqual(Object.keys(owner.body).sort(), ['createdAt', 'email', 'id']);
  await request(app.getHttpServer()).post('/v1/auth/register').send({ email: 'OWNER@lab.test', password }).expect(409);
  await request(app.getHttpServer()).post('/v1/auth/register').send({ email: 'other@lab.test', password }).expect(201);
  const { rows } = await database.query<{ password_hash: string }>('SELECT password_hash FROM users ORDER BY email');
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0]!.password_hash, rows[1]!.password_hash);
  assert.ok(rows.every((row) => row.password_hash.startsWith('scrypt$v1$') && !row.password_hash.includes(password)));
});

test('login issues a bounded token and gives the same error for invalid credentials', async () => {
  const owner = await request(app.getHttpServer()).post('/v1/auth/login').send({ email: 'OWNER@lab.test', password }).expect(200);
  ownerToken = owner.body.access_token;
  assert.equal(owner.body.expires_in, 900);
  assert.equal(owner.body.token_type, 'Bearer');
  assert.ok(!owner.text.includes('password_hash'));
  const other = await request(app.getHttpServer()).post('/v1/auth/login').send({ email: 'other@lab.test', password }).expect(200);
  otherToken = other.body.access_token;
  const wrong = await request(app.getHttpServer()).post('/v1/auth/login').send({ email: 'owner@lab.test', password: 'wrong-password' }).expect(401);
  const missing = await request(app.getHttpServer()).post('/v1/auth/login').send({ email: 'unknown@lab.test', password }).expect(401);
  assert.deepEqual(wrong.body, missing.body);
  assert.match(wrong.headers['cache-control'] ?? '', /no-store/);
});

test('all task operations require authentication', async () => {
  const id = randomUUID();
  await request(app.getHttpServer()).get('/v1/tasks').expect(401);
  await request(app.getHttpServer()).post('/v1/tasks').send({ title: 'Test' }).expect(401);
  await request(app.getHttpServer()).get(`/v1/tasks/${id}`).expect(401);
  await request(app.getHttpServer()).patch(`/v1/tasks/${id}`).send({ completed: true }).expect(401);
  await request(app.getHttpServer()).delete(`/v1/tasks/${id}`).expect(401);
});

test('forged, expired, wrongly scoped, nonexpiring, and unknown-user tokens are rejected', async () => {
  const signer = new JwtService({ secret: config.jwtSecret });
  const options = { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: 900 };
  const tokens = [
    'malformed-token',
    new JwtService({ secret: randomBytes(32).toString('hex') }).sign({ sub: ownerId }, options),
    signer.sign({ sub: ownerId }, { ...options, expiresIn: -1 }),
    signer.sign({ sub: ownerId }, { ...options, issuer: 'other-service' }),
    signer.sign({ sub: ownerId }, { ...options, audience: 'other-audience' }),
    signer.sign({ sub: ownerId }, { ...options, algorithm: 'HS384' }),
    signer.sign({ sub: ownerId }, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE }),
    signer.sign({ sub: randomUUID() }, options),
  ];
  for (const token of tokens) {
    await request(app.getHttpServer()).get('/v1/tasks').set('Authorization', `Bearer ${token}`).expect(401);
  }
});

test('owners can create, list, read, and update tasks including completed=false', async () => {
  const title = "read'; DROP TABLE users; --";
  const created = await request(app.getHttpServer()).post('/v1/tasks').auth(ownerToken, { type: 'bearer' })
    .send({ title, description: 'Synthetic SQL-like content' }).expect(201);
  taskId = created.body.id;
  assert.equal(created.body.title, title);
  assert.equal(created.body.completed, false);
  const list = await request(app.getHttpServer()).get('/v1/tasks?limit=1&offset=0').auth(ownerToken, { type: 'bearer' }).expect(200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].id, taskId);
  await request(app.getHttpServer()).get(`/v1/tasks/${taskId}`).auth(ownerToken, { type: 'bearer' }).expect(200);
  const update = await request(app.getHttpServer()).patch(`/v1/tasks/${taskId}`).auth(ownerToken, { type: 'bearer' })
    .send({ completed: true, title: 'Updated task' }).expect(200);
  assert.equal(update.body.completed, true);
  const reset = await request(app.getHttpServer()).patch(`/v1/tasks/${taskId}`).auth(ownerToken, { type: 'bearer' })
    .send({ completed: false, description: '' }).expect(200);
  assert.equal(reset.body.completed, false);
  assert.equal(reset.body.description, '');
  assert.equal((await database.query('SELECT id FROM users')).rows.length, 2);
});

test('another user cannot list, read, update, delete, or claim an owner task', async () => {
  await request(app.getHttpServer()).get('/v1/tasks').auth(otherToken, { type: 'bearer' }).expect(200, []);
  await request(app.getHttpServer()).get(`/v1/tasks/${taskId}`).auth(otherToken, { type: 'bearer' }).expect(404);
  await request(app.getHttpServer()).patch(`/v1/tasks/${taskId}`).auth(otherToken, { type: 'bearer' }).send({ title: 'Stolen' }).expect(404);
  await request(app.getHttpServer()).delete(`/v1/tasks/${taskId}`).auth(otherToken, { type: 'bearer' }).expect(404);
  await request(app.getHttpServer()).post('/v1/tasks').auth(otherToken, { type: 'bearer' }).send({ title: 'New', owner_id: ownerId }).expect(400);
  const unchanged = await request(app.getHttpServer()).get(`/v1/tasks/${taskId}`).auth(ownerToken, { type: 'bearer' }).expect(200);
  assert.equal(unchanged.body.title, 'Updated task');
});

test('task inputs reject empty changes, nulls, oversized values, malformed IDs and pagination', async () => {
  for (const body of [{ title: ' ' }, { title: 'a'.repeat(201) }, { title: 'OK', description: null }, { title: 'OK', admin: true }]) {
    await request(app.getHttpServer()).post('/v1/tasks').auth(ownerToken, { type: 'bearer' }).send(body).expect(400);
  }
  for (const body of [{}, { completed: 'true' }, { title: null }, { completed: null }, { owner_id: ownerId }]) {
    await request(app.getHttpServer()).patch(`/v1/tasks/${taskId}`).auth(ownerToken, { type: 'bearer' }).send(body).expect(400);
  }
  await request(app.getHttpServer()).get('/v1/tasks/not-a-uuid').auth(ownerToken, { type: 'bearer' }).expect(400);
  for (const query of ['limit=101', 'offset=-1', 'limit=abc', 'unknown=true']) {
    await request(app.getHttpServer()).get(`/v1/tasks?${query}`).auth(ownerToken, { type: 'bearer' }).expect(400);
  }
});

test('JSON body limits reject oversized uploads', async () => {
  await request(app.getHttpServer()).post('/v1/tasks').auth(ownerToken, { type: 'bearer' })
    .send({ title: 'Test', description: 'x'.repeat(40000) }).expect(413);
});

test('an owner can delete a task and subsequent reads return 404', async () => {
  await request(app.getHttpServer()).delete(`/v1/tasks/${taskId}`).auth(ownerToken, { type: 'bearer' }).expect(204);
  await request(app.getHttpServer()).get(`/v1/tasks/${taskId}`).auth(ownerToken, { type: 'bearer' }).expect(404);
});

test('OpenAPI describes the protected API and bearer authentication', async () => {
  const response = await request(app.getHttpServer()).get('/docs-json').expect(200);
  assert.ok(response.body.paths['/v1/auth/login']);
  assert.ok(response.body.paths['/v1/tasks']);
  assert.deepEqual(response.body.paths['/v1/tasks'].get.security, [{ bearer: [] }]);
  assert.equal(response.body.components.securitySchemes.bearer.scheme, 'bearer');
});

test('changed migration checksums fail migration and readiness checks', async () => {
  const [migration] = await readMigrations();
  await admin.query('UPDATE schema_migrations SET checksum = $1 WHERE name = $2', ['invalid', migration!.name]);
  try {
    await request(app.getHttpServer()).get('/health/ready').expect(503);
    await assert.rejects(runMigrations(migrationUrl), /Applied migration changed/);
  } finally {
    await admin.query('UPDATE schema_migrations SET checksum = $1 WHERE name = $2', [migration!.checksum, migration!.name]);
  }
  await request(app.getHttpServer()).get('/health/ready').expect(200);
});

test('database connectivity failure leaves liveness available and readiness unavailable', async () => {
  const unavailable = { ...config, databaseUrl: 'postgresql://test:test@127.0.0.1:1/lab_test', docsEnabled: false };
  const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(APP_CONFIG).useValue(unavailable).compile();
  const disconnected = module.createNestApplication({ bodyParser: false, logger: false });
  setupApplication(disconnected, unavailable);
  await disconnected.init();
  try {
    await request(disconnected.getHttpServer()).get('/health/live').expect(200);
    await request(disconnected.getHttpServer()).get('/health/ready').expect(503);
    await request(disconnected.getHttpServer()).get('/docs-json').expect(404);
  } finally {
    await disconnected.close();
  }
});

test('login rate limits repeated attempts', async () => {
  let blocked = false;
  for (let attempt = 0; attempt < 11; attempt++) {
    const response = await request(app.getHttpServer()).post('/v1/auth/login').set('X-Forwarded-For', `192.0.2.${attempt + 1}`)
      .send({ email: 'unknown@lab.test', password });
    if (response.status === 429) { blocked = true; break; }
    assert.equal(response.status, 401);
  }
  assert.equal(blocked, true);
});

test('the runtime database role cannot alter schema or migration history', async () => {
  await assert.rejects(database.query('CREATE TABLE forbidden_change (id integer)'), (error: unknown) =>
    typeof error === 'object' && error !== null && 'code' in error && error.code === '42501');
  await assert.rejects(database.query('UPDATE schema_migrations SET checksum = $1', ['invalid']), (error: unknown) =>
    typeof error === 'object' && error !== null && 'code' in error && error.code === '42501');
});
