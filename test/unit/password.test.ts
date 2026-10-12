import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword } from '../../src/auth/password';

test('password hashes are salted and verify only the correct password', async () => {
  const password = `${randomUUID()}-test-only`;
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
  assert.equal(await verifyPassword(password, null), false);
});

test('unsupported or corrupt stored hashes cannot authenticate', async () => {
  assert.equal(await verifyPassword('anything', 'scrypt$v999$bad$bad'), false);
  assert.equal(await verifyPassword('anything', 'not-a-password-hash'), false);
});
