import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';

const base = process.env.API_URL ?? 'http://api:3000';
const phase = process.env.CHECK_PHASE ?? 'prepare';
let token;
async function call(path, method = 'GET', body, expected = 200, bearer = token) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, expected, `${method} ${path}`);
  return expected === 204 ? undefined : response.json();
}
async function login(email, password) {
  return (await call('/v1/auth/login', 'POST', { email, password }, 200, undefined)).access_token;
}
async function denied(host, port) {
  const connected = await new Promise((resolve) => {
    const socket = createConnection({ host, port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.setTimeout(2000, () => { socket.destroy(); resolve(false); });
  });
  assert.equal(connected, false, `Unexpected access to ${host}:${port}`);
}
await call('/health/live');
await call('/health/ready');
if (phase === 'prepare') {
  for (const prefix of ['OWNER', 'OTHER']) {
    await call('/v1/auth/register', 'POST', {
      email: process.env[`${prefix}_EMAIL`], password: process.env[`${prefix}_PASSWORD`],
    }, 201, undefined);
  }
}
token = await login(process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD);
const other = await login(process.env.OTHER_EMAIL, process.env.OTHER_PASSWORD);
if (phase === 'resume') {
  const retained = await call(`/v1/tasks/${process.env.TASK_ID}`);
  assert.equal(retained.title, process.env.TASK_TITLE);
  assert.equal(retained.completed, true);
  await call(`/v1/tasks/${retained.id}`, 'GET', undefined, 404, other);
  await call(`/v1/tasks/${retained.id}`, 'DELETE', undefined, 204);
  console.log(JSON.stringify({ passed: true, phase, persistence: true, ownership: true }));
} else {
  await call('/v1/tasks', 'GET', undefined, 401, 'invalid-token');
  await call('/v1/tasks', 'POST', { title: 'invalid', extra: true }, 400);
  const title = `Staging persistence proof ${randomUUID()}`;
  const created = await call('/v1/tasks', 'POST', { title, description: 'Synthetic staging verification' }, 201);
  await call(`/v1/tasks/${created.id}`);
  await call(`/v1/tasks/${created.id}`, 'GET', undefined, 404, other);
  await call(`/v1/tasks/${created.id}`, 'PATCH', { completed: true }, 404, other);
  await call(`/v1/tasks/${created.id}`, 'DELETE', undefined, 404, other);
  const updated = await call(`/v1/tasks/${created.id}`, 'PATCH', { completed: true });
  assert.equal(updated.completed, true);
  assert.equal((await call('/v1/tasks', 'GET', undefined, 200, other)).length, 0);
  await denied('postgres', 5432);
  await denied('1.1.1.1', 443);
  console.log(JSON.stringify({ passed: true, phase, task_id: created.id, task_title: title,
    health: true, authentication: true, ownership: true, validation: true,
    verifier_database_denied: true, verifier_external_egress_denied: true }));
}
