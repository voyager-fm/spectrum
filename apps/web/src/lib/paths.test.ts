import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localPath, repositoryContext, repositoryPath } from './paths.ts';

describe('repositoryContext', () => {
  it('reads the repository and tab from GitHub repository paths', () => {
    assert.deepEqual(repositoryContext('/repositories/voyager-fm/spectrum'), {
      kind: 'github',
      owner: 'voyager-fm',
      repo: 'spectrum',
      tab: 'overview',
    });
    assert.equal(repositoryContext('/repositories/voyager-fm/spectrum/specs').tab, 'specs');
    assert.equal(
      repositoryContext('/repositories/voyager-fm/spectrum/specs/VAL-001-x').tab,
      'specs',
    );
    assert.equal(repositoryContext('/repositories/voyager-fm/spectrum/specsheet').tab, 'overview');
  });

  it('treats every other path as the local repository', () => {
    assert.deepEqual(repositoryContext('/'), { kind: 'local', tab: 'overview' });
    assert.deepEqual(repositoryContext('/specs/VAL-001-x'), { kind: 'local', tab: 'specs' });
    assert.equal(repositoryContext('/repositories').kind, 'local');
    assert.equal(repositoryContext('/rules').tab, 'overview');
  });
});

describe('paths', () => {
  it('keeps the tab when switching repositories and encodes names', () => {
    assert.equal(
      repositoryPath('voyager-fm', 'spectrum', 'specs'),
      '/repositories/voyager-fm/spectrum/specs',
    );
    assert.equal(repositoryPath('a', 'b.c'), '/repositories/a/b.c');
    assert.equal(localPath('specs'), '/specs');
    assert.equal(localPath(), '/');
  });
});
