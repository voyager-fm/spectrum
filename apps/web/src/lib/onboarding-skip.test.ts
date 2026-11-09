import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseSkipped,
  REPOSITORIES_GUIDE,
  repositoryGuide,
  updateSkipped,
} from './onboarding-skip.ts';

describe('skipped onboarding guides', () => {
  it('adds and restores guides by key', () => {
    const key = repositoryGuide('Voyager-FM', 'spectrum');
    assert.equal(key, 'voyager-fm/spectrum');
    const once = updateSkipped(undefined, key, true);
    const twice = updateSkipped(once, REPOSITORIES_GUIDE, true);
    assert.deepEqual([...parseSkipped(twice)], ['voyager-fm/spectrum', 'repositories']);
    assert.deepEqual([...parseSkipped(updateSkipped(twice, key, false))], ['repositories']);
    assert.equal(updateSkipped(once, key, true), once, 'skipping twice keeps one key');
  });

  it('ignores keys that are not guides', () => {
    assert.deepEqual([...parseSkipped('repositories|../etc|a b/c|x/y')], ['repositories', 'x/y']);
    assert.equal(updateSkipped('', '<script>', true), '');
  });

  it('keeps only the most recent hundred keys', () => {
    let value = '';
    for (let i = 0; i < 120; i++) value = updateSkipped(value, `owner/repo-${i}`, true);
    const keys = [...parseSkipped(value)];
    assert.equal(keys.length, 100);
    assert.equal(keys[0], 'owner/repo-20');
  });
});
