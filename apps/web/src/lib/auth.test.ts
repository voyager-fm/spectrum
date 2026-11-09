import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { accountsConfig, canRead, safeNext, type Viewer } from './auth.ts';

describe('accountsConfig', () => {
  it('is off without any account variable and partial when some are missing', () => {
    assert.deepEqual(accountsConfig({}), { status: 'off' });
    assert.deepEqual(accountsConfig({ GITHUB_APP_CLIENT_ID: 'Iv1.x' }), {
      status: 'partial',
      missing: ['DATABASE_URL', 'GITHUB_APP_CLIENT_SECRET'],
    });
  });
});

describe('canRead', () => {
  it('opens everything to the single operator and nothing to an anonymous visitor', () => {
    assert.equal(canRead({ mode: 'single-operator' }, 1), true);
    assert.equal(canRead({ mode: 'accounts', user: null, installations: [] }, 1), false);
    assert.equal(canRead({ mode: 'misconfigured', missing: [] }, 1), false);
  });

  it('limits a signed-in user to the installations synced from GitHub', () => {
    const viewer = {
      mode: 'accounts',
      user: { id: 'u' },
      installations: [{ installationId: 7, workspaceId: 'w', account: 'a' }],
    } as unknown as Viewer;
    assert.equal(canRead(viewer, 7), true);
    assert.equal(canRead(viewer, 8), false);
  });
});

describe('safeNext', () => {
  it('follows only same-site relative paths', () => {
    assert.equal(safeNext('/repositories/a/b?pr=1'), '/repositories/a/b?pr=1');
    for (const unsafe of [
      'https://evil.example',
      '//evil.example',
      '/\\evil',
      'repositories',
      null,
    ]) {
      assert.equal(safeNext(unsafe), '/');
    }
  });
});
