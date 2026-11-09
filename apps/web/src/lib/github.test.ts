import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { after, describe, it } from 'node:test';
import type { CheckResult } from '@spectrum/core';
import { extractSnapshot, GitHubError, type Repository } from '@spectrum/integrations/github';
import { checkRepository } from '@spectrum/spec-engine';
import { inspectRepositorySetup, type RepositorySetup } from '@spectrum/spec-engine/setup';
import { accessibleInstallations, syncMemberships, upsertUser } from '../db/store.ts';
import { testDatabase } from '../db/testing.ts';
import type { Viewer } from './auth.ts';
import {
  AnalysisCache,
  type GitHubDependencies,
  githubAppStatus,
  loadConnectedRepositories,
  loadRepositoryCheck,
  parseRepositoryInput,
  parseTarget,
} from './github.ts';

const SHA = 'd'.repeat(40);
const PR_SHA = 'e'.repeat(40);
const repository: Repository = {
  id: 1450780976,
  owner: 'voyager-fm',
  name: 'spectrum',
  fullName: 'voyager-fm/spectrum',
  private: false,
  defaultBranch: 'main',
  htmlUrl: 'https://github.com/voyager-fm/spectrum',
};
const status = {
  configured: true,
  missing: [],
  installUrl: 'https://github.com/apps/x/installations/new',
};
const passing = { ok: true, findings: [], specs: [] } as unknown as CheckResult;
const missing = (path: string) => ({ state: 'missing' as const, path, detail: null });
const noSetup: RepositorySetup = {
  config: missing('.spectrum/config.json'),
  package: missing('package.json'),
  skills: {
    claude: missing('.claude/skills/spectrum/SKILL.md'),
    codex: missing('.agents/skills/spectrum/SKILL.md'),
  },
  plugin: missing('.claude/settings.json'),
};

/** Labeled mock: an in-memory App and repository client, never a live GitHub call. */
function fakeDependencies(overrides: Partial<GitHubDependencies> = {}) {
  const log: string[] = [];
  const client = {
    getRepository: async () => repository,
    listBranches: async () => {
      log.push('branches');
      return [{ name: 'main', sha: SHA }];
    },
    listOpenPullRequests: async () => {
      log.push('pulls');
      return [];
    },
    getPullRequest: async (n: number) => ({
      number: n,
      title: 'Add GitHub',
      headRef: 'feat/github',
      headSha: PR_SHA,
      htmlUrl: '',
    }),
    resolveCommit: async (ref: string) => {
      log.push(`resolve ${ref}`);
      return SHA;
    },
    downloadTarball: async (sha: string) => {
      log.push(`tarball ${sha}`);
      return Readable.from([]);
    },
  };
  const deps: GitHubDependencies = {
    status,
    app: {
      listInstallations: async () => [
        { id: 1, account: 'voyager-fm', accountId: 99, targetType: 'Organization' },
      ],
      listRepositories: async () => [repository],
      repositoryInstallation: async (owner: string) => (owner === 'voyager-fm' ? 1 : null),
      installationClient: async () => client as never,
    },
    viewer: { mode: 'single-operator' },
    db: null,
    extract: (async () => ({
      root: '/snapshot',
      dispose: async () => {
        log.push('dispose');
      },
    })) as never,
    check: async (root) => {
      log.push(`check ${root}`);
      return passing;
    },
    setup: async () => noSetup,
    cache: new AnalysisCache(),
    now: () => new Date('2026-11-09T00:00:00Z'),
    ...overrides,
  };
  return { deps, log };
}

describe('githubAppStatus', () => {
  it('reports missing variable names without throwing or exposing values', async () => {
    const result = await githubAppStatus({ GITHUB_APP_ID: '42' });
    assert.equal(result.configured, false);
    assert.deepEqual(result.missing, [
      'GITHUB_APP_SLUG',
      'GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH',
    ]);
    assert.equal(result.installUrl, null);
  });

  it('treats an unreadable key path as not configured', async () => {
    const result = await githubAppStatus({
      GITHUB_APP_ID: '42',
      GITHUB_APP_SLUG: 'spectrum-dev',
      GITHUB_APP_PRIVATE_KEY_PATH: '/nonexistent/key.pem',
    });
    assert.equal(result.configured, false);
    assert.equal(result.installUrl, 'https://github.com/apps/spectrum-dev/installations/new');
  });
});

describe('parseTarget', () => {
  it('prefers a pull request, then a ref, then the default branch', () => {
    assert.deepEqual(parseTarget({ pr: '4', ref: 'main' }), { kind: 'pr', number: 4 });
    assert.deepEqual(parseTarget({ ref: 'feat/x' }), { kind: 'ref', ref: 'feat/x' });
    assert.deepEqual(parseTarget({}), { kind: 'default' });
    assert.equal(parseTarget({ pr: '-1' }).kind, 'invalid');
    assert.equal(parseTarget({ ref: '../x' }).kind, 'invalid');
  });
});

describe('parseRepositoryInput', () => {
  it('accepts owner/name and GitHub URLs and rejects other paths', () => {
    const expected = { owner: 'voyager-fm', repo: 'spectrum' };
    assert.deepEqual(parseRepositoryInput(' voyager-fm/spectrum '), expected);
    assert.deepEqual(parseRepositoryInput('https://github.com/voyager-fm/spectrum.git'), expected);
    assert.equal(parseRepositoryInput('voyager-fm'), null);
    assert.equal(parseRepositoryInput('voyager-fm/spectrum/tree/main'), null);
    assert.equal(parseRepositoryInput('https://example.com/a/b'), null);
  });
});

describe('loadConnectedRepositories', () => {
  it('returns no repositories and no error when the App is not configured', async () => {
    const result = await loadConnectedRepositories({
      ...fakeDependencies().deps,
      app: null,
      status: { configured: false, missing: ['GITHUB_APP_ID'], installUrl: null },
    });
    assert.deepEqual(result.repositories, []);
    assert.deepEqual(result.errors, []);
  });

  it('reports a GitHub failure instead of an empty list', async () => {
    const { deps } = fakeDependencies();
    const result = await loadConnectedRepositories({
      ...deps,
      app: {
        ...(deps.app as NonNullable<GitHubDependencies['app']>),
        listInstallations: async () => {
          throw new GitHubError(401, 'GitHub returned 401');
        },
      },
    });
    assert.deepEqual(result.repositories, []);
    assert.match(result.errors[0] ?? '', /401/);
  });
});

describe('AnalysisCache', () => {
  it('evicts the least recently used commit past its limit', async () => {
    const cache = new AnalysisCache(2);
    let runs = 0;
    const run = async () => {
      runs += 1;
      return { result: passing, setup: noSetup, checkedAt: '' };
    };
    await cache.get('a', run);
    await cache.get('b', run);
    await cache.get('a', run);
    await cache.get('c', run);
    assert.equal(runs, 3);
    await cache.get('a', run);
    assert.equal(runs, 3, 'a was used recently and stays cached');
    await cache.get('b', run);
    assert.equal(runs, 4, 'b was evicted');
  });
});

describe('loadRepositoryCheck', () => {
  it('checks the default branch at its resolved SHA and disposes the snapshot', async () => {
    const { deps, log } = fakeDependencies();
    const view = await loadRepositoryCheck('voyager-fm', 'spectrum', { kind: 'default' }, deps);
    assert.equal(view.status, 'ready');
    if (view.status !== 'ready') return;
    assert.equal(view.check?.sha, SHA);
    assert.equal(view.check?.ref, 'main');
    assert.equal(view.check?.checkedAt, '2026-11-09T00:00:00.000Z');
    assert.deepEqual(log, [
      'branches',
      'pulls',
      'resolve main',
      `tarball ${SHA}`,
      'check /snapshot',
      'dispose',
    ]);
    assert.deepEqual(view.check?.setup, noSetup);
  });

  it('reuses the analysis of a commit it already checked', async () => {
    const { deps, log } = fakeDependencies();
    const first = await loadRepositoryCheck('voyager-fm', 'spectrum', { kind: 'default' }, deps);
    const later = { ...deps, now: () => new Date('2026-11-09T01:00:00Z') };
    const second = await loadRepositoryCheck(
      'voyager-fm',
      'spectrum',
      { kind: 'ref', ref: SHA },
      later,
      { refs: false },
    );
    assert.equal(log.filter((line) => line.startsWith('tarball')).length, 1);
    assert.equal(second.status === 'ready' && second.check?.ref, SHA);
    // The cached result keeps the time it was computed, not the time it was read.
    assert.equal(
      second.status === 'ready' && second.check?.checkedAt,
      first.status === 'ready' && first.check?.checkedAt,
    );
    assert.equal(log.filter((line) => line === 'branches').length, 1);
  });

  it('retries an analysis that failed instead of caching the failure', async () => {
    let calls = 0;
    const { deps } = fakeDependencies({
      check: async () => {
        calls += 1;
        if (calls === 1) throw new Error('transient');
        return passing;
      },
    });
    const failed = await loadRepositoryCheck('voyager-fm', 'spectrum', { kind: 'default' }, deps);
    assert.equal(failed.status === 'ready' && failed.check, null);
    const retried = await loadRepositoryCheck('voyager-fm', 'spectrum', { kind: 'default' }, deps);
    assert.equal(retried.status === 'ready' && retried.check?.result.ok, true);
    assert.equal(calls, 2);
  });

  it('checks a pull request at its head SHA', async () => {
    const { deps, log } = fakeDependencies();
    const view = await loadRepositoryCheck(
      'voyager-fm',
      'spectrum',
      { kind: 'pr', number: 4 },
      deps,
    );
    assert.equal(view.status === 'ready' && view.check?.sha, PR_SHA);
    assert.equal(view.status === 'ready' && view.check?.ref, '#4 (feat/github)');
    assert.ok(log.includes(`tarball ${PR_SHA}`));
  });

  it('disposes the snapshot and reports the error when the check throws', async () => {
    const { deps, log } = fakeDependencies({
      check: async () => {
        throw new Error('secret internal detail');
      },
    });
    const view = await loadRepositoryCheck('voyager-fm', 'spectrum', { kind: 'default' }, deps);
    assert.equal(view.status, 'ready');
    if (view.status !== 'ready') return;
    assert.equal(view.check, null);
    assert.deepEqual(view.errors, ['Unexpected error while talking to GitHub.']);
    assert.equal(log.at(-1), 'dispose');
  });

  it('separates not configured, not installed and invalid names', async () => {
    const { deps } = fakeDependencies();
    assert.equal(
      (await loadRepositoryCheck('o', 'r', { kind: 'default' }, { ...deps, app: null })).status,
      'not-configured',
    );
    assert.equal(
      (await loadRepositoryCheck('someone', 'else', { kind: 'default' }, deps)).status,
      'not-installed',
    );
    assert.equal(
      (await loadRepositoryCheck('voyager-fm', '..', { kind: 'default' }, deps)).status,
      'invalid',
    );
  });

  it('reports a missing revision separately from a failed check', async () => {
    const { deps } = fakeDependencies();
    const app = deps.app as NonNullable<GitHubDependencies['app']>;
    const client = (await app.installationClient('voyager-fm', 'spectrum', 1)) as unknown as {
      resolveCommit: (ref: string) => Promise<string>;
    };
    client.resolveCommit = async () => {
      throw new GitHubError(422, 'GitHub returned 422');
    };
    const view = await loadRepositoryCheck(
      'voyager-fm',
      'spectrum',
      { kind: 'ref', ref: 'does-not-exist' },
      deps,
    );
    assert.equal(view.status === 'ready' && view.failure, 'revision-not-found');
    assert.deepEqual(view.status === 'ready' && view.errors, [
      'GitHub found no commit for this ref (422).',
    ]);
  });

  it('never assesses an invalid target', async () => {
    const { deps, log } = fakeDependencies();
    const view = await loadRepositoryCheck(
      'voyager-fm',
      'spectrum',
      { kind: 'invalid', message: 'Ref is not a valid branch, tag or SHA.' },
      deps,
    );
    assert.equal(view.status === 'ready' && view.check, null);
    assert.deepEqual(log, ['branches', 'pulls'], 'nothing is resolved or downloaded');
  });
});

const work = await mkdtemp(join(tmpdir(), 'spectrum-web-github-'));
after(() => rm(work, { recursive: true, force: true }));

describe('remote snapshot with the real spec engine', () => {
  it('refuses a config symlink that points outside the snapshot', async () => {
    const top = join(work, 'src', 'evil-repo-abc1234');
    await mkdir(join(top, '.spectrum'), { recursive: true });
    await writeFile(join(work, 'outside.json'), '{"schema_version":2}');
    await symlink(join(work, 'outside.json'), join(top, '.spectrum', 'config.json'));
    const archive = join(work, 'evil.tar.gz');
    execFileSync('tar', ['-czf', archive, '-C', join(work, 'src'), 'evil-repo-abc1234']);

    const { deps } = fakeDependencies({
      extract: extractSnapshot,
      check: (root) => checkRepository(root),
    });
    const app = deps.app as NonNullable<GitHubDependencies['app']>;
    const client = (await app.installationClient('voyager-fm', 'spectrum', 1)) as unknown as {
      downloadTarball: (sha: string) => Promise<Readable>;
    };
    client.downloadTarball = async () => createReadStream(archive);

    const view = await loadRepositoryCheck('voyager-fm', 'spectrum', { kind: 'default' }, deps);
    assert.equal(view.status, 'ready');
    if (view.status !== 'ready') return;
    assert.equal(view.check?.result.ok, false);
    assert.ok(view.check?.result.findings.some((f) => f.path === '.spectrum/config.json'));
  });

  it('reports the declared setup from the snapshot', async () => {
    const top = join(work, 'src', 'client-repo-abc1234');
    await mkdir(join(top, '.claude', 'skills', 'spectrum'), { recursive: true });
    await writeFile(
      join(top, 'package.json'),
      JSON.stringify({ devDependencies: { '@voyager-fm/spectrum': '^0.1.0' } }),
    );
    await writeFile(
      join(top, '.claude', 'skills', 'spectrum', 'SKILL.md'),
      '<!-- Generated by @voyager-fm/spectrum 0.1.0; reinstall with: npx --no spectrum skills install -->\n',
    );
    const archive = join(work, 'client.tar.gz');
    execFileSync('tar', ['-czf', archive, '-C', join(work, 'src'), 'client-repo-abc1234']);

    const { deps } = fakeDependencies({
      extract: extractSnapshot,
      check: (root) => checkRepository(root),
      setup: inspectRepositorySetup,
    });
    const app = deps.app as NonNullable<GitHubDependencies['app']>;
    const client = (await app.installationClient('voyager-fm', 'spectrum', 1)) as unknown as {
      downloadTarball: (sha: string) => Promise<Readable>;
    };
    client.downloadTarball = async () => createReadStream(archive);

    const view = await loadRepositoryCheck('voyager-fm', 'spectrum', { kind: 'default' }, deps);
    assert.equal(view.status, 'ready');
    if (view.status !== 'ready') return;
    const setup = view.check?.setup;
    assert.equal(setup?.config.state, 'missing');
    assert.deepEqual(setup?.package, { state: 'ok', path: 'package.json', detail: '^0.1.0' });
    assert.equal(setup?.skills.claude.state, 'ok');
    assert.equal(setup?.skills.claude.detail, '0.1.0');
    assert.equal(setup?.skills.codex.state, 'missing');
  });
});

describe('access in accounts mode', () => {
  const member = (installationId: number): Viewer => ({
    mode: 'accounts',
    user: {
      id: 'u1',
      githubId: 5,
      login: 'octo',
      name: null,
      avatarUrl: '',
      createdAt: new Date(),
      lastSignedInAt: new Date(),
    },
    installations: [{ installationId, workspaceId: 'w1', account: 'voyager-fm' }],
  });

  it('asks for sign-in before touching GitHub', async () => {
    const { deps, log } = fakeDependencies({
      viewer: { mode: 'accounts', user: null, installations: [] },
    });
    const view = await loadRepositoryCheck('voyager-fm', 'spectrum', { kind: 'default' }, deps);
    assert.equal(view.status, 'sign-in');
    assert.deepEqual(log, []);
    const list = await loadConnectedRepositories(deps);
    assert.deepEqual(list.repositories, []);
    assert.deepEqual(list.installations, []);
  });

  it('withholds data when account settings are incomplete', async () => {
    const { deps } = fakeDependencies({
      viewer: { mode: 'misconfigured', missing: ['GITHUB_APP_CLIENT_SECRET'] },
    });
    const view = await loadRepositoryCheck('voyager-fm', 'spectrum', { kind: 'default' }, deps);
    assert.deepEqual(view.status === 'misconfigured' && view.accountsMissing, [
      'GITHUB_APP_CLIENT_SECRET',
    ]);
    assert.deepEqual((await loadConnectedRepositories(deps)).repositories, []);
  });

  it('treats an installation outside the user workspaces as not installed', async () => {
    const { deps, log } = fakeDependencies({ viewer: member(2) });
    const view = await loadRepositoryCheck('voyager-fm', 'spectrum', { kind: 'default' }, deps);
    assert.equal(view.status, 'not-installed');
    assert.deepEqual(log, [], 'no token is used for a repository the user cannot read');
    assert.deepEqual((await loadConnectedRepositories(deps)).repositories, []);
  });

  it('lists and checks repositories of the user installations', async () => {
    const { deps } = fakeDependencies({ viewer: member(1) });
    const list = await loadConnectedRepositories(deps);
    assert.deepEqual(
      list.repositories.map((r) => r.fullName),
      ['voyager-fm/spectrum'],
    );
    const view = await loadRepositoryCheck('voyager-fm', 'spectrum', { kind: 'default' }, deps);
    assert.equal(view.status, 'ready');
  });

  it('stores each commit once and reuses it after a restart', async () => {
    const { db, close } = await testDatabase();
    try {
      const user = await upsertUser(
        db,
        { id: 5, login: 'octo', name: null, avatarUrl: '' },
        new Date(),
      );
      await syncMemberships(
        db,
        user.id,
        [{ id: 1, account: 'voyager-fm', accountId: 99, targetType: 'Organization' }],
        new Date(),
      );
      const viewer: Viewer = {
        mode: 'accounts',
        user,
        installations: await accessibleInstallations(db, user.id),
      };
      const first = fakeDependencies({ viewer, db });
      const view = await loadRepositoryCheck(
        'voyager-fm',
        'spectrum',
        { kind: 'default' },
        first.deps,
      );
      assert.equal(view.status === 'ready' && view.history?.length, 1);
      assert.equal(view.status === 'ready' && view.history?.[0]?.triggeredBy, 'octo');

      // A new process: empty memory cache, same database. Nothing is downloaded again.
      const restarted = fakeDependencies({ viewer, db, cache: new AnalysisCache() });
      const again = await loadRepositoryCheck(
        'voyager-fm',
        'spectrum',
        { kind: 'default' },
        restarted.deps,
      );
      assert.equal(again.status === 'ready' && again.check?.sha, SHA);
      assert.equal(again.status === 'ready' && again.check?.checkedAt, '2026-11-09T00:00:00.000Z');
      assert.ok(!restarted.log.some((line) => line.startsWith('tarball')));
    } finally {
      await close();
    }
  });
});
