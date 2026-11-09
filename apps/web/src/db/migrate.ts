import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Apply the SQL migrations in ./drizzle to DATABASE_URL. Run with `pnpm db:migrate`.
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('DATABASE_URL is not set. Add it to apps/web/.env.local.');
  process.exit(1);
}
const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), {
    migrationsFolder: resolve(import.meta.dirname, '../../drizzle'),
  });
  console.log('Database is up to date.');
} finally {
  await client.end();
}
