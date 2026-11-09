import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Service data for the hosted dashboard. GitHub stays the authority for who can reach which
 * installation; these tables record what Spectrum learned at sign-in and what it checked.
 * No GitHub token is stored.
 */

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: bigint('github_id', { mode: 'number' }).notNull().unique(),
  login: text('login').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url').notNull(),
  createdAt: created(),
  lastSignedInAt: timestamp('last_signed_in_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Session ids are SHA-256 hashes of the cookie value; the raw token is never stored. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: created(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** One workspace per GitHub account (organization or user) that installed the App. */
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubAccountId: bigint('github_account_id', { mode: 'number' }).notNull().unique(),
  accountLogin: text('account_login').notNull(),
  accountType: text('account_type').notNull(),
  createdAt: created(),
});

/** Members are the users GitHub reported as able to access the workspace's installation. */
export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

export const installations = pgTable('installations', {
  /** GitHub's installation id. */
  id: bigint('id', { mode: 'number' }).primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  createdAt: created(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

/** One deterministic analysis per repository commit. Re-checking the same SHA reuses it. */
export const checkRuns = pgTable(
  'check_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    installationId: bigint('installation_id', { mode: 'number' }).notNull(),
    repositoryId: bigint('repository_id', { mode: 'number' }).notNull(),
    repository: text('repository').notNull(),
    sha: text('sha').notNull(),
    /** The ref label of the first request that analyzed this commit. */
    ref: text('ref').notNull(),
    ok: boolean('ok').notNull(),
    errors: integer('errors').notNull(),
    warnings: integer('warnings').notNull(),
    specs: integer('specs').notNull(),
    result: jsonb('result').notNull(),
    setup: jsonb('setup').notNull(),
    triggeredBy: uuid('triggered_by').references(() => users.id, { onDelete: 'set null' }),
    analyzedAt: timestamp('analyzed_at', { withTimezone: true }).notNull(),
    createdAt: created(),
  },
  (t) => [
    unique('check_runs_repository_sha').on(t.repositoryId, t.sha),
    index('check_runs_repository_idx').on(t.repositoryId, sql`${t.analyzedAt} desc`),
  ],
);
