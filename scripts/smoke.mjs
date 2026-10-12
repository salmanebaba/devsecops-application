import { randomBytes, randomUUID } from 'node:crypto';

const baseUrl = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? '3000'}`;
const password = randomBytes(24).toString('hex');
const email = `smoke-${randomUUID()}@lab.test`;
let token;
let taskId;

async function call(path, method = 'GET', body, expected = 200) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (response.status !== expected) throw new Error(`${method} ${path}: expected ${expected}, received ${response.status}`);
  return response.status === 204 ? undefined : response.json();
}

try {
  await call('/health/live');
  await call('/health/ready');
  await call('/v1/auth/register', 'POST', { email, password }, 201);
  token = (await call('/v1/auth/login', 'POST', { email, password })).access_token;
  const task = await call('/v1/tasks', 'POST', { title: 'Container smoke test' }, 201);
  taskId = task.id;
  await call(`/v1/tasks/${taskId}`);
  const updated = await call(`/v1/tasks/${taskId}`, 'PATCH', { completed: true });
  if (!updated.completed) throw new Error('Task completion was not persisted');
  await call(`/v1/tasks/${taskId}`, 'DELETE', undefined, 204);
  taskId = undefined;
  console.log('PASS: running API health, registration, login, and task CRUD.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (taskId && token) {
    try { await call(`/v1/tasks/${taskId}`, 'DELETE', undefined, 204); }
    catch { console.error('The smoke-test task could not be cleaned up.'); }
  }
}
