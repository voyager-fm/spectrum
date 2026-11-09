import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Database } from './client.ts';
import * as schema from './schema.ts';

/**
 * An in-process Postgres (PGlite) with the real migrations applied. Tests use it instead of a
 * container; it runs the same SQL the server runs.
 */
export async function testDatabase(): Promise<{ db: Database; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../../drizzle') });
  return { db: db as unknown as Database, close: () => client.close() };
}
