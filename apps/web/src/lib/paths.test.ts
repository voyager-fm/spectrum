import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localPath, repositoryContext, repositoryPath, specificationNav } from './paths.ts';

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

describe('specificationNav', () => {
  it('points Overview and Specs at the connected repository and hides Rules', () => {
    const nav = specificationNav('/repositories/voyager-fm/spectrum/specs/VAL-001-x');
    assert.deepEqual(nav.overview, { href: '/repositories/voyager-fm/spectrum', active: false });
    assert.deepEqual(nav.specs, { href: '/repositories/voyager-fm/spectrum/specs', active: true });
    assert.equal(nav.rules, null);
    assert.equal(specificationNav('/repositories/voyager-fm/spectrum').overview.active, true);
  });

  it('uses local paths elsewhere and marks only the page that is shown', () => {
    assert.deepEqual(specificationNav('/'), {
      overview: { href: '/', active: true },
      specs: { href: '/specs', active: false },
      rules: { href: '/rules', active: false },
    });
    assert.equal(specificationNav('/specs/documents').specs.active, true);
    const rules = specificationNav('/rules');
    assert.equal(rules.overview.active, false);
    assert.equal(rules.rules?.active, true);
    for (const path of ['/settings', '/repositories', '/runs']) {
      const nav = specificationNav(path);
      assert.equal(nav.overview.active || nav.specs.active, false, path);
      assert.equal(nav.overview.href, '/', path);
    }
  });
});
