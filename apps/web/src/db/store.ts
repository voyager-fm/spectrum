import { createHash, randomBytes } from 'node:crypto';
import type { CheckResult } from '@spectrum/core';
import type { GitHubUser, Installation } from '@spectrum/integrations/github';
import type { RepositorySetup } from '@spectrum/spec-engine/setup';
import { and, desc, eq, gt, lte, notInArray } from 'drizzle-orm';
import type { Database } from './client.ts';
import {
  checkRuns,
  installations,
  sessions,
  users,
  workspaceMembers,
  workspaces,
} from './schema.ts';

export const SESSION_DAYS = 7;

export type User = typeof users.$inferSelect;

/** Create or refresh the user GitHub authenticated. */
export async function upsertUser(db: Database, github: GitHubUser, now: Date): Promise<User> {
  const [row] = await db
    .insert(users)
    .values({
      githubId: github.id,
      login: github.login,
      name: github.name,
      avatarUrl: github.avatarUrl,
      lastSignedInAt: now,
    })
    .onConflictDoUpdate({
      target: users.githubId,
      set: {
        login: github.login,
        name: github.name,
        avatarUrl: github.avatarUrl,
        lastSignedInAt: now,
      },
    })
    .returning();
  if (!row) throw new Error('User upsert returned no row');
  return row;
}

/**
 * Make the user's workspaces match the installations GitHub says they can access right now.
 * Workspaces and installations are created as needed; memberships GitHub no longer reports
 * are removed.
 */
export async function syncMemberships(
  db: Database,
  userId: string,
  accessible: Installation[],
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const workspaceIds: string[] = [];
    for (const inst of accessible) {
      if (!inst.accountId) continue;
      const [workspace] = await tx
        .insert(workspaces)
        .values({
          githubAccountId: inst.accountId,
          accountLogin: inst.account,
          accountType: inst.targetType,
        })
        .onConflictDoUpdate({
          target: workspaces.githubAccountId,
          set: { accountLogin: inst.account, accountType: inst.targetType },
        })
        .returning({ id: workspaces.id });
      if (!workspace) continue;
      workspaceIds.push(workspace.id);
      await tx
        .insert(installations)
        .values({ id: inst.id, workspaceId: workspace.id, lastSeenAt: now })
        .onConflictDoUpdate({
          target: installations.id,
          set: { workspaceId: workspace.id, lastSeenAt: now },
        });
      await tx
        .insert(workspaceMembers)
        .values({ workspaceId: workspace.id, userId, syncedAt: now })
        .onConflictDoUpdate({
          target: [workspaceMembers.workspaceId, workspaceMembers.userId],
          set: { syncedAt: now },
        });
    }
    await tx
      .delete(workspaceMembers)
      .where(
        workspaceIds.length
          ? and(
              eq(workspaceMembers.userId, userId),
              notInArray(workspaceMembers.workspaceId, workspaceIds),
            )
          : eq(workspaceMembers.userId, userId),
      );
  });
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Start a session and return the raw token for the cookie. Only its hash is stored. */
export async function createSession(db: Database, userId: string, now: Date): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000),
  });
  return token;
}

export async function sessionUser(db: Database, token: string, now: Date): Promise<User | null> {
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, now)))
    .limit(1);
  return row?.user ?? null;
}

export async function deleteSession(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export async function deleteExpiredSessions(db: Database, now: Date): Promise<void> {
  await db.delete(sessions).where(lte(sessions.expiresAt, now));
}

export interface AccessibleInstallation {
  installationId: number;
  workspaceId: string;
  account: string;
}

/** Installations the user may read through Spectrum, from the last sync with GitHub. */
export async function accessibleInstallations(
  db: Database,
  userId: string,
): Promise<AccessibleInstallation[]> {
  return db
    .select({
      installationId: installations.id,
      workspaceId: installations.workspaceId,
      account: workspaces.accountLogin,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .innerJoin(installations, eq(installations.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));
}

export interface StoredAnalysis {
  result: CheckResult;
  setup: RepositorySetup;
  checkedAt: string;
}

export interface CheckRecord {
  workspaceId: string;
  installationId: number;
  repositoryId: number;
  repository: string;
  sha: string;
  ref: string;
  triggeredBy: string | null;
  analysis: StoredAnalysis;
}

export async function findCheck(
  db: Database,
  repositoryId: number,
  sha: string,
): Promise<StoredAnalysis | null> {
  const [row] = await db
    .select({ result: checkRuns.result, setup: checkRuns.setup, analyzedAt: checkRuns.analyzedAt })
    .from(checkRuns)
    .where(and(eq(checkRuns.repositoryId, repositoryId), eq(checkRuns.sha, sha)))
    .limit(1);
  if (!row) return null;
  return {
    result: row.result as CheckResult,
    setup: row.setup as RepositorySetup,
    checkedAt: row.analyzedAt.toISOString(),
  };
}

/** Store one commit's analysis. A commit that was already stored keeps its first record. */
export async function recordCheck(db: Database, record: CheckRecord): Promise<void> {
  const { result, setup, checkedAt } = record.analysis;
  const errors = result.findings.filter((f) => f.severity === 'error').length;
  await db
    .insert(checkRuns)
    .values({
      workspaceId: record.workspaceId,
      installationId: record.installationId,
      repositoryId: record.repositoryId,
      repository: record.repository,
      sha: record.sha,
      ref: record.ref,
      ok: result.ok,
      errors,
      warnings: result.findings.length - errors,
      specs: result.specs.length,
      result,
      setup,
      triggeredBy: record.triggeredBy,
      analyzedAt: new Date(checkedAt),
    })
    .onConflictDoNothing({ target: [checkRuns.repositoryId, checkRuns.sha] });
}

export interface CheckHistoryRow {
  sha: string;
  ref: string;
  ok: boolean;
  errors: number;
  warnings: number;
  specs: number;
  analyzedAt: string;
  triggeredBy: string | null;
}

/** Most recent analyses of a repository, newest first. */
export async function listChecks(
  db: Database,
  repositoryId: number,
  limit = 20,
): Promise<CheckHistoryRow[]> {
  const rows = await db
    .select({
      sha: checkRuns.sha,
      ref: checkRuns.ref,
      ok: checkRuns.ok,
      errors: checkRuns.errors,
      warnings: checkRuns.warnings,
      specs: checkRuns.specs,
      analyzedAt: checkRuns.analyzedAt,
      triggeredBy: users.login,
    })
    .from(checkRuns)
    .leftJoin(users, eq(users.id, checkRuns.triggeredBy))
    .where(eq(checkRuns.repositoryId, repositoryId))
    .orderBy(desc(checkRuns.analyzedAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, analyzedAt: r.analyzedAt.toISOString() }));
}
