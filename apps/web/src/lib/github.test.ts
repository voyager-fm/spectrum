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
import {
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

/** Labeled mock: an in-memory App and repository client, never a live GitHub call. */
function fakeDependencies(overrides: Partial<GitHubDependencies> = {}) {
  const log: string[] = [];
  const client = {
    getRepository: async () => repository,
    listBranches: async () => [{ name: 'main', sha: SHA }],
    listOpenPullRequests: async () => [],
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
      listInstallations: async () => [{ id: 1, account: 'voyager-fm', targetType: 'Organization' }],
      listRepositories: async () => [repository],
      repositoryClient: async (owner: string) => (owner === 'voyager-fm' ? client : null) as never,
    },
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

describe('loadRepositoryCheck', () => {
  it('checks the default branch at its resolved SHA and disposes the snapshot', async () => {
    const { deps, log } = fakeDependencies();
    const view = await loadRepositoryCheck('voyager-fm', 'spectrum', { kind: 'default' }, deps);
    assert.equal(view.status, 'ready');
    if (view.status !== 'ready') return;
    assert.equal(view.check?.sha, SHA);
    assert.equal(view.check?.ref, 'main');
    assert.equal(view.check?.checkedAt, '2026-11-09T00:00:00.000Z');
    assert.deepEqual(log, [`resolve main`, `tarball ${SHA}`, 'check /snapshot', 'dispose']);
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
    const client = (await app.repositoryClient('voyager-fm', 'spectrum')) as unknown as {
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
    assert.deepEqual(log, []);
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
    const client = (await app.repositoryClient('voyager-fm', 'spectrum')) as unknown as {
      downloadTarball: (sha: string) => Promise<Readable>;
    };
    client.downloadTarball = async () => createReadStream(archive);

    const view = await loadRepositoryCheck('voyager-fm', 'spectrum', { kind: 'default' }, deps);
    assert.equal(view.status, 'ready');
    if (view.status !== 'ready') return;
    assert.equal(view.check?.result.ok, false);
    assert.ok(view.check?.result.findings.some((f) => f.path === '.spectrum/config.json'));
  });
});
