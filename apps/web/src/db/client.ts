import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

/** Any Drizzle Postgres database with this schema: postgres.js in the server, PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

type Env = Record<string, string | undefined>;

const globalDb = globalThis as typeof globalThis & {
  spectrumDb?: { url: string; db: Database };
};

/**
 * The service database, or null when `DATABASE_URL` is not set. One pool per process, kept on
 * `globalThis` so development reloads do not open new connections.
 */
export function database(env: Env = process.env): Database | null {
  const url = env.DATABASE_URL?.trim();
  if (!url) return null;
  if (globalDb.spectrumDb?.url !== url) {
    const client = postgres(url, { max: 5, onnotice: () => {} });
    globalDb.spectrumDb = { url, db: drizzle(client, { schema }) as unknown as Database };
  }
  return globalDb.spectrumDb.db;
}
