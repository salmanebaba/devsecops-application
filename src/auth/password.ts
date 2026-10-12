import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// OWASP's scrypt alternative: N=2^15, r=8, p=3 (about 32 MiB per operation).
// Version the encoding so future parameter upgrades can be migrated explicitly.
const OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const DUMMY_HASH = `scrypt$v1$${randomBytes(16).toString('hex')}$${randomBytes(64).toString('hex')}`;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, OPTIONS, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `scrypt$v1$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  const [algorithm, version, salt, hash, extra] = (storedHash ?? DUMMY_HASH).split('$');
  if (algorithm !== 'scrypt' || version !== 'v1' || extra !== undefined ||
      !salt || !/^[a-f0-9]{32}$/.test(salt) || !hash || !/^[a-f0-9]{128}$/.test(hash)) {
    return false;
  }
  const actual = await derive(password, Buffer.from(salt, 'hex'));
  const matches = timingSafeEqual(actual, Buffer.from(hash, 'hex'));
  return storedHash !== null && matches;
}
