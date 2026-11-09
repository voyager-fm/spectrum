import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { CheckResult } from '@spectrum/core';
import type { RepositorySetup } from '@spectrum/spec-engine/setup';
import type { Database } from './client.ts';
import { sessions } from './schema.ts';
import {
  accessibleInstallations,
  createSession,
  deleteSession,
  findCheck,
  listChecks,
  recordCheck,
  sessionUser,
  syncMemberships,
  upsertUser,
} from './store.ts';
import { testDatabase } from './testing.ts';

const NOW = new Date('2026-11-09T00:00:00Z');
let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await testDatabase());
});
after(() => close());

const octo = { id: 5, login: 'octo', name: 'Octo', avatarUrl: 'https://a/5' };
const org = { id: 7, account: 'voyager-fm', accountId: 99, targetType: 'Organization' };
const personal = { id: 8, account: 'octo', accountId: 5, targetType: 'User' };

describe('users and sessions', () => {
  it('upserts a user by GitHub id and keeps the profile current', async () => {
    const first = await upsertUser(db, octo, NOW);
    const renamed = await upsertUser(db, { ...octo, login: 'octo2' }, NOW);
    assert.equal(renamed.id, first.id);
    assert.equal(renamed.login, 'octo2');
  });

  it('stores only a hash of the session token and expires sessions', async () => {
    const user = await upsertUser(db, octo, NOW);
    const token = await createSession(db, user.id, NOW);
    const stored = await db.select().from(sessions);
    assert.ok(
      stored.every((s) => s.id !== token),
      'raw token is not stored',
    );
    assert.equal((await sessionUser(db, token, NOW))?.id, user.id);
    assert.equal(await sessionUser(db, token, new Date('2026-11-17T00:00:00Z')), null);
    assert.equal(await sessionUser(db, 'forged', NOW), null);
    await deleteSession(db, token);
    assert.equal(await sessionUser(db, token, NOW), null);
  });
});

describe('workspace membership', () => {
  it('follows the installations GitHub reports for the user', async () => {
    const user = await upsertUser(db, octo, NOW);
    await syncMemberships(db, user.id, [org, personal], NOW);
    const both = await accessibleInstallations(db, user.id);
    assert.deepEqual(both.map((i) => i.installationId).sort(), [7, 8]);

    // GitHub no longer reports the organization installation: access is removed.
    await syncMemberships(db, user.id, [personal], NOW);
    const one = await accessibleInstallations(db, user.id);
    assert.deepEqual(
      one.map((i) => [i.installationId, i.account]),
      [[8, 'octo']],
    );

    await syncMemberships(db, user.id, [], NOW);
    assert.deepEqual(await accessibleInstallations(db, user.id), []);
  });

  it('shares an organization workspace between its members', async () => {
    const a = await upsertUser(db, { ...octo, id: 11, login: 'a' }, NOW);
    const b = await upsertUser(db, { ...octo, id: 12, login: 'b' }, NOW);
    await syncMemberships(db, a.id, [org], NOW);
    await syncMemberships(db, b.id, [org], NOW);
    const [ia] = await accessibleInstallations(db, a.id);
    const [ib] = await accessibleInstallations(db, b.id);
    assert.equal(ia?.workspaceId, ib?.workspaceId);
  });
});

describe('check history', () => {
  const result = {
    ok: false,
    findings: [{ severity: 'error' }, { severity: 'warning' }],
    specs: [{}, {}, {}],
  } as unknown as CheckResult;
  const setup = { config: { state: 'ok' } } as unknown as RepositorySetup;

  it('keeps one analysis per commit and lists them newest first', async () => {
    const user = await upsertUser(db, octo, NOW);
    await syncMemberships(db, user.id, [org], NOW);
    const [inst] = await accessibleInstallations(db, user.id);
    assert.ok(inst);
    const base = {
      workspaceId: inst.workspaceId,
      installationId: inst.installationId,
      repositoryId: 42,
      repository: 'voyager-fm/spectrum',
      triggeredBy: user.id,
    };
    await recordCheck(db, {
      ...base,
      sha: 'a'.repeat(40),
      ref: 'main',
      analysis: { result, setup, checkedAt: '2026-11-09T01:00:00.000Z' },
    });
    await recordCheck(db, {
      ...base,
      sha: 'a'.repeat(40),
      ref: 'feature',
      analysis: { result, setup, checkedAt: '2026-11-09T03:00:00.000Z' },
    });
    await recordCheck(db, {
      ...base,
      sha: 'b'.repeat(40),
      ref: '#4 (feature)',
      analysis: { result, setup, checkedAt: '2026-11-09T02:00:00.000Z' },
    });

    const stored = await findCheck(db, 42, 'a'.repeat(40));
    assert.equal(stored?.checkedAt, '2026-11-09T01:00:00.000Z', 'the first analysis is kept');
    assert.deepEqual(stored?.result, result);

    const history = await listChecks(db, 42);
    assert.deepEqual(
      history.map((h) => [h.sha[0], h.ref, h.errors, h.warnings, h.specs, h.triggeredBy]),
      [
        ['b', '#4 (feature)', 1, 1, 3, 'octo'],
        ['a', 'main', 1, 1, 3, 'octo'],
      ],
    );
    assert.equal(await findCheck(db, 42, 'c'.repeat(40)), null);
  });
});
