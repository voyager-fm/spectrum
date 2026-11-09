import type { ChangeSet } from '../../core/src/index.ts';
export interface SpecAgent {
  propose(input: { goal: string; repositoryRevision: string; context: string[] }): Promise<ChangeSet>;
}
// No model calls, subscriptions, API keys, or shell execution are wired yet.
export function assertPublishable(change: ChangeSet, currentRevision: string): void {
  if (change.status !== 'approved') throw new Error('Human approval required');
  if (change.baseRevision !== currentRevision) throw new Error('Repository changed; review again');
  if (!change.edits.length) throw new Error('Empty change set');
}
// This guard is not a publisher. Production must also bind approval to the
// exact edit-content digest and recheck target-file hashes atomically.
