import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPublishable } from './index.ts';
import type { ChangeSet } from '@spectrum/core';
test('approval and stale revision guards', () => {
  const c: ChangeSet = {
    id: 'c1',
    baseRevision: 'abc',
    summary: 'test',
    edits: [
      {
        path: '.spectrum/overview.md',
        beforeHash: 'hash',
        proposedText: 'new',
      },
    ],
    status: 'proposed',
  };
  assert.throws(() => assertPublishable(c, 'abc'), /approval/);
  assert.throws(
    () => assertPublishable({ ...c, status: 'approved' }, 'def'),
    /changed/,
  );
  assert.doesNotThrow(() =>
    assertPublishable({ ...c, status: 'approved' }, 'abc'),
  );
});
