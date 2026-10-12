import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';
import { APP_CONFIG, AppConfig } from '../config/config';
import { readMigrations } from './migrations';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      connectionTimeoutMillis: 2000,
      statement_timeout: 3000,
      query_timeout: 3500,
    });
    this.pool.on('error', () => new Logger(DatabaseService.name).error('An idle database connection failed'));
  }

  query<T extends QueryResultRow>(sql: string, values: unknown[] = []) {
    return this.pool.query<T>(sql, values);
  }

  async isReady(): Promise<boolean> {
    try {
      const expected = await readMigrations();
      const { rows } = await this.query<{ name: string; checksum: string }>('SELECT name, checksum FROM schema_migrations');
      return rows.length === expected.length && expected.every((migration) =>
        rows.some((row) => row.name === migration.name && row.checksum === migration.checksum));
    } catch {
      return false;
    }
  }

  async onModuleDestroy() { await this.pool.end(); }
}
