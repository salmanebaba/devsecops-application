import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

export interface Migration { name: string; sql: string; checksum: string }

export async function readMigrations(directory = resolve(process.cwd(), 'migrations')): Promise<Migration[]> {
  const names = (await readdir(directory)).filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
  if (!names.length) throw new Error('No database migrations found');
  return Promise.all(names.map(async (name) => {
    const sql = await readFile(resolve(directory, name), 'utf8');
    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
}

export async function runMigrations(databaseUrl: string, directory?: string): Promise<string[]> {
  const migrations = await readMigrations(directory);
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize migrations even before the schema_migrations table exists.
      await client.query('SELECT pg_advisory_xact_lock(1862807739)');
      await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
      )`);
      const existing = await client.query<{ name: string; checksum: string }>('SELECT name, checksum FROM schema_migrations');
      for (const record of existing.rows) {
        if (migrations.find((migration) => migration.name === record.name)?.checksum !== record.checksum) {
          throw new Error(`Applied migration changed or is missing: ${record.name}`);
        }
      }
      const applied: string[] = [];
      for (const migration of migrations) {
        if (existing.rows.some((record) => record.name === migration.name)) continue;
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [migration.name, migration.checksum]);
        applied.push(migration.name);
      }
      await client.query('COMMIT');
      return applied;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
