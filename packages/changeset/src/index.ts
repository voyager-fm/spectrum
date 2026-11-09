import type { ChangeSet } from '@spectrum/core';

// Proposal approval and staleness rules shared by the CLI, plugin and dashboard.
// Model calls happen in the user's host agent, never in this package.
export function assertPublishable(
  change: ChangeSet,
  currentRevision: string,
): void {
  if (change.status !== 'approved') throw new Error('Human approval required');
  if (change.baseRevision !== currentRevision)
    throw new Error('Repository changed; review again');
  if (!change.edits.length) throw new Error('Empty change set');
}
// This guard is not a publisher. Applying a change must also bind approval to
// the exact edit-content digest and recheck target-file hashes atomically.
