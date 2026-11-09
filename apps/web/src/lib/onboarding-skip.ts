/**
 * Which onboarding guides this browser chose to skip. A cookie (not storage) so the server
 * renders the skipped state without the guide flashing first. It holds only keys, no data.
 */

export const SKIP_COOKIE = 'spectrum_onboarding_skipped';

/** The Getting started strip on /repositories. Repository checklists use `owner/name`. */
export const REPOSITORIES_GUIDE = 'repositories';

const MAX_KEYS = 100;
const SEPARATOR = '|';
const KEY = /^(?:repositories|[a-z0-9-]{1,39}\/[a-z0-9_.-]{1,100})$/;

export function repositoryGuide(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase();
}

export function isGuideKey(value: unknown): value is string {
  return typeof value === 'string' && KEY.test(value);
}

export function parseSkipped(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(value.split(SEPARATOR).filter(isGuideKey).slice(-MAX_KEYS));
}

/** The cookie value after skipping or restoring one guide. The most recent keys are kept. */
export function updateSkipped(value: string | undefined, key: string, skipped: boolean): string {
  const keys = [...parseSkipped(value)].filter((existing) => existing !== key);
  if (skipped && isGuideKey(key)) keys.push(key);
  return keys.slice(-MAX_KEYS).join(SEPARATOR);
}
