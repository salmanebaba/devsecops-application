import { Global, Module } from '@nestjs/common';
import { readFileSync } from 'node:fs';

export function readSecret(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name];
  const file = env[`${name}_FILE`];
  if (value && file) throw new Error(`${name} must use either a value or a mounted file`);
  if (!file) return value;
  try {
    const content = readFileSync(file, 'utf8').trim();
    if (!content || Buffer.byteLength(content) > 4096) throw new Error();
    return content;
  } catch {
    throw new Error(`${name}_FILE must be a readable, non-empty secret file`);
  }
}

export const APP_CONFIG = Symbol('APP_CONFIG');
export const JWT_ISSUER = 'devsecops-demo-api';
export const JWT_AUDIENCE = 'devsecops-lab';

export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtTtlSeconds: number;
  docsEnabled: boolean;
}

function integer(value: string | undefined, fallback: number, name: string, max: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
  return parsed;
}

export function validateDatabaseUrl(value: string | undefined): string {
  try {
    const url = new URL(value ?? '');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname === '/') {
      throw new Error();
    }
    return value!;
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
  }
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const secret = readSecret(env, 'JWT_SECRET') ?? '';
  if (Buffer.byteLength(secret) < 32 || /replace|change.?me|example/i.test(secret)) {
    throw new Error('JWT_SECRET must contain at least 32 bytes and cannot be a placeholder');
  }
  const docsEnabled = env.DOCS_ENABLED ?? 'false';
  if (!['true', 'false'].includes(docsEnabled)) {
    throw new Error('DOCS_ENABLED must be true or false');
  }
  return {
    port: integer(env.PORT, 3000, 'PORT', 65535),
    databaseUrl: validateDatabaseUrl(readSecret(env, 'DATABASE_URL')),
    jwtSecret: secret,
    jwtTtlSeconds: integer(env.JWT_TTL_SECONDS, 900, 'JWT_TTL_SECONDS', 3600),
    docsEnabled: docsEnabled === 'true',
  };
}

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigurationModule {}
