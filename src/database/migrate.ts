import { readSecret, validateDatabaseUrl } from '../config/config';
import { runMigrations } from './migrations';

runMigrations(validateDatabaseUrl(readSecret(process.env, 'MIGRATION_DATABASE_URL')))
  .then((names) => console.log(names.length ? `Applied: ${names.join(', ')}` : 'Database migrations are up to date.'))
  .catch((error: unknown) => {
    // Connection errors can contain credentials; do not print the connection URL.
    console.error(error instanceof Error && error.message.startsWith('Applied migration')
      ? error.message : 'Migration failed. Check database connectivity and migration SQL.');
    process.exitCode = 1;
  });
