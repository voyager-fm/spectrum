import { readFile } from 'node:fs/promises';
import type { CheckResult } from '@spectrum/core';
import {
  type Branch,
  extractSnapshot,
  GITHUB_API,
  GitHubApp,
  GitHubError,
  type Installation,
  type PullRequest,
  type Repository,
  SnapshotError,
  validRef,
  validRepositoryName,
} from '@spectrum/integrations/github';
import { checkRepository } from '@spectrum/spec-engine';
import { inspectRepositorySetup, type RepositorySetup } from '@spectrum/spec-engine/setup';

/**
 * Server-only GitHub App service. Credentials come from the server environment and never
 * reach a page, a response body or `.spectrum/`. Every call is read-only.
 */

export const REQUIRED_ENV = ['GITHUB_APP_ID', 'GITHUB_APP_SLUG', 'GITHUB_APP_PRIVATE_KEY'] as const;

export interface GitHubAppStatus {
  configured: boolean;
  /** Names of missing or unreadable variables; never their values. */
  missing: string[];
  installUrl: string | null;
}

interface Credentials {
  appId: string;
  privateKey: string;
}

type Env = Record<string, string | undefined>;

async function readCredentials(
  env: Env,
): Promise<{ status: GitHubAppStatus; credentials: Credentials | null }> {
  const missing: string[] = [];
  const appId = env.GITHUB_APP_ID?.trim();
  const slug = env.GITHUB_APP_SLUG?.trim();
  if (!appId) missing.push('GITHUB_APP_ID');
  if (!slug) missing.push('GITHUB_APP_SLUG');
  let privateKey = env.GITHUB_APP_PRIVATE_KEY?.replaceAll('\\n', '\n').trim();
  if (!privateKey && env.GITHUB_APP_PRIVATE_KEY_PATH) {
    try {
      privateKey = (await readFile(env.GITHUB_APP_PRIVATE_KEY_PATH, 'utf8')).trim();
    } catch {
      missing.push('GITHUB_APP_PRIVATE_KEY_PATH (unreadable)');
    }
  } else if (!privateKey) {
    missing.push('GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH');
  }
  const installUrl =
    slug && /^[a-z0-9-]+$/i.test(slug) ? `https://github.com/apps/${slug}/installations/new` : null;
  const configured = missing.length === 0 && Boolean(appId && privateKey);
  return {
    status: { configured, missing, installUrl },
    credentials: configured ? { appId: appId as string, privateKey: privateKey as string } : null,
  };
}

/** Whether this server can act as the GitHub App. Never throws. */
export async function githubAppStatus(env: Env = process.env): Promise<GitHubAppStatus> {
  return (await readCredentials(env)).status;
}

export interface GitHubDependencies {
  /** Null when the App is not configured. */
  app: Pick<GitHubApp, 'listInstallations' | 'listRepositories' | 'repositoryClient'> | null;
  status: GitHubAppStatus;
  extract: typeof extractSnapshot;
  check: (root: string) => Promise<CheckResult>;
  setup: (root: string) => Promise<RepositorySetup>;
  /** Analyses keyed by repository and commit SHA. A commit's content never changes. */
  cache: AnalysisCache;
  now: () => Date;
}

/** What one snapshot yields: the structural check and the declared Spectrum setup. */
export interface SnapshotAnalysis {
  result: CheckResult;
  setup: RepositorySetup;
  /** When this analysis ran; cached results keep their original time. */
  checkedAt: string;
}

/** Bounded in-memory cache of analyses per `owner/name@sha`, oldest entry evicted first. */
export class AnalysisCache {
  readonly #entries = new Map<string, Promise<SnapshotAnalysis>>();
  readonly #limit: number;
  constructor(limit = 24) {
    this.#limit = limit;
  }
  /** Reuse a finished or in-flight analysis; a failed one is dropped so the next call retries. */
  get(key: string, run: () => Promise<SnapshotAnalysis>): Promise<SnapshotAnalysis> {
    const cached = this.#entries.get(key);
    if (cached) {
      this.#entries.delete(key);
      this.#entries.set(key, cached);
      return cached;
    }
    const pending = run();
    this.#entries.set(key, pending);
    pending.catch(() => {
      if (this.#entries.get(key) === pending) this.#entries.delete(key);
    });
    while (this.#entries.size > this.#limit) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
    return pending;
  }
}

const analyses = new AnalysisCache();

let shared: { key: string; app: GitHubApp } | null = null;

/** One App instance per credential set, so installation tokens are reused across requests. */
export async function githubDependencies(env: Env = process.env): Promise<GitHubDependencies> {
  const { status, credentials } = await readCredentials(env);
  let app: GitHubApp | null = null;
  if (credentials) {
    // Optional API base for GitHub Enterprise Server or a local test double.
    const base = env.GITHUB_API_URL?.replace(/\/+$/, '');
    const key = `${credentials.appId}:${credentials.privateKey}:${base ?? ''}`;
    if (shared?.key !== key) {
      shared = {
        key,
        app: new GitHubApp({
          ...credentials,
          fetch: base ? (url, init) => fetch(url.replace(GITHUB_API, base), init) : undefined,
        }),
      };
    }
    app = shared.app;
  }
  return {
    app,
    status,
    extract: extractSnapshot,
    check: (root) => checkRepository(root),
    setup: inspectRepositorySetup,
    cache: analyses,
    now: () => new Date(),
  };
}

/** Safe, user-facing error text. Unknown errors are not echoed. */
export function describeError(error: unknown): string {
  if (error instanceof GitHubError) {
    if (error.status === 401) return 'GitHub rejected the App credentials (401).';
    if (error.status === 403)
      return 'GitHub refused access (403). Check App permissions or rate limits.';
    if (error.status === 404)
      return 'GitHub returned 404. The ref, pull request or repository is not visible to the App.';
    if (error.status === 422) return 'GitHub found no commit for this ref (422).';
    return error.message;
  }
  if (error instanceof SnapshotError) return `Snapshot failed: ${error.message}`;
  return 'Unexpected error while talking to GitHub.';
}

export interface ConnectedRepository extends Repository {
  installationId: number;
  account: string;
}

export interface ConnectedRepositories {
  status: GitHubAppStatus;
  installations: Installation[];
  repositories: ConnectedRepository[];
  errors: string[];
}

export async function loadConnectedRepositories(
  deps?: GitHubDependencies,
): Promise<ConnectedRepositories> {
  const d = deps ?? (await githubDependencies());
  const empty = { status: d.status, installations: [], repositories: [], errors: [] };
  if (!d.app) return empty;
  let installations: Installation[];
  try {
    installations = await d.app.listInstallations();
  } catch (error) {
    return { ...empty, errors: [`Installations: ${describeError(error)}`] };
  }
  const errors: string[] = [];
  const repositories: ConnectedRepository[] = [];
  for (const installation of installations) {
    try {
      for (const repo of await d.app.listRepositories(installation.id)) {
        repositories.push({
          ...repo,
          installationId: installation.id,
          account: installation.account,
        });
      }
    } catch (error) {
      errors.push(`Installation ${installation.account}: ${describeError(error)}`);
    }
  }
  repositories.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return { status: d.status, installations, repositories, errors };
}

const CONNECTED_TTL_MS = 60_000;
let connected: { at: number; value: Promise<ConnectedRepositories> } | null = null;

/**
 * The connected repository list for navigation, reused for a minute so every page render does
 * not call GitHub. Failed loads are not reused.
 */
export async function cachedConnectedRepositories(): Promise<ConnectedRepositories> {
  const deps = await githubDependencies();
  if (!deps.app) return loadConnectedRepositories(deps);
  if (connected && Date.now() - connected.at < CONNECTED_TTL_MS) return connected.value;
  const value = loadConnectedRepositories(deps);
  connected = { at: Date.now(), value };
  const result = await value;
  if (result.errors.length && connected?.value === value) connected = null;
  return result;
}

export interface SwitcherRepositories {
  configured: boolean;
  repositories: { owner: string; name: string; fullName: string; private: boolean }[];
  /** True when GitHub failed or did not answer in time; the list is then incomplete. */
  unavailable: boolean;
}

/**
 * Connected repositories for the sidebar switcher. Navigation must never wait long on GitHub,
 * so a slow answer is reported as unavailable instead of blocking every page.
 */
export async function switcherRepositories(timeoutMs = 3000): Promise<SwitcherRepositories> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const data = await Promise.race([cachedConnectedRepositories(), timeout]);
    if (!data) return { configured: true, repositories: [], unavailable: true };
    return {
      configured: data.status.configured,
      repositories: data.repositories.map((r) => ({
        owner: r.owner,
        name: r.name,
        fullName: r.fullName,
        private: r.private,
      })),
      unavailable: data.errors.length > 0,
    };
  } catch {
    return { configured: true, repositories: [], unavailable: true };
  } finally {
    clearTimeout(timer);
  }
}

/** Accept `owner/name`, `github.com/owner/name` or a full GitHub URL; anything else is null. */
export function parseRepositoryInput(input: string): { owner: string; repo: string } | null {
  const path = input
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^(www\.)?github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
  const [owner, repo, ...rest] = path.split('/');
  if (!owner || !repo || rest.length || !validRepositoryName(owner, repo)) return null;
  return { owner, repo };
}

/** What to check: the default branch, a named ref, or an open pull request head. */
export type CheckTarget =
  | { kind: 'default' }
  | { kind: 'ref'; ref: string }
  | { kind: 'pr'; number: number };

/** Parse `?ref=` / `?pr=` query values. Invalid input becomes an error, not a silent default. */
export function parseTarget(query: {
  ref?: string | string[];
  pr?: string | string[];
}): CheckTarget | { kind: 'invalid'; message: string } {
  const ref = Array.isArray(query.ref) ? query.ref[0] : query.ref;
  const pr = Array.isArray(query.pr) ? query.pr[0] : query.pr;
  if (pr !== undefined && pr !== '') {
    const number = Number(pr);
    if (!Number.isInteger(number) || number < 1) {
      return { kind: 'invalid', message: 'Pull request must be a positive number.' };
    }
    return { kind: 'pr', number };
  }
  if (ref !== undefined && ref !== '') {
    if (!validRef(ref))
      return { kind: 'invalid', message: 'Ref is not a valid branch, tag or SHA.' };
    return { kind: 'ref', ref };
  }
  return { kind: 'default' };
}

export interface RemoteCheck {
  repository: string;
  /** Human label of what was checked: a branch, a SHA or `#12 (head-ref)`. */
  ref: string;
  target: CheckTarget;
  /** The exact commit the result belongs to. */
  sha: string;
  checkedAt: string;
  result: CheckResult;
  /** Spectrum pieces the commit declares: configuration, package, agent skills and plugin. */
  setup: RepositorySetup;
}

export type RepositoryView =
  | { status: 'not-configured'; app: GitHubAppStatus }
  | { status: 'invalid'; app: GitHubAppStatus; message: string }
  | { status: 'not-installed'; app: GitHubAppStatus; fullName: string }
  | {
      status: 'ready';
      app: GitHubAppStatus;
      repository: Repository;
      branches: Branch[];
      pullRequests: PullRequest[];
      check: RemoteCheck | null;
      /** Why `check` is null: the requested revision does not exist, or a later step failed. */
      failure?: 'invalid-target' | 'revision-not-found' | 'failed';
      errors: string[];
    }
  | { status: 'error'; app: GitHubAppStatus; fullName: string; errors: string[] };

/**
 * Load a repository's refs and run the deterministic spec check and setup inspection on one
 * pinned commit. The snapshot is removed whether the check succeeds or fails, and the analysis
 * is cached per commit SHA so moving between pages does not download the repository again.
 */
export async function loadRepositoryCheck(
  owner: string,
  repo: string,
  target: CheckTarget | { kind: 'invalid'; message: string },
  deps?: GitHubDependencies,
  options: { refs?: boolean } = {},
): Promise<RepositoryView> {
  const withRefs = options.refs ?? true;
  const d = deps ?? (await githubDependencies());
  const fullName = `${owner}/${repo}`;
  if (!d.app) return { status: 'not-configured', app: d.status };
  if (!validRepositoryName(owner, repo)) {
    return {
      status: 'invalid',
      app: d.status,
      message: 'Repository must be written as owner/name.',
    };
  }
  let client: Awaited<ReturnType<GitHubApp['repositoryClient']>>;
  try {
    client = await d.app.repositoryClient(owner, repo);
  } catch (error) {
    return { status: 'error', app: d.status, fullName, errors: [describeError(error)] };
  }
  if (!client) return { status: 'not-installed', app: d.status, fullName };

  let repository: Repository;
  let branches: Branch[];
  let pullRequests: PullRequest[];
  try {
    // Spec pages only need the pinned commit, so they skip the branch and pull request lists.
    [repository, branches, pullRequests] = await Promise.all([
      client.getRepository(),
      withRefs ? client.listBranches() : [],
      withRefs ? client.listOpenPullRequests() : [],
    ]);
  } catch (error) {
    return { status: 'error', app: d.status, fullName, errors: [describeError(error)] };
  }
  const ready = { status: 'ready' as const, app: d.status, repository, branches, pullRequests };
  if (target.kind === 'invalid') {
    return { ...ready, check: null, failure: 'invalid-target', errors: [target.message] };
  }

  let label: string;
  let sha: string;
  try {
    if (target.kind === 'pr') {
      const pr = await client.getPullRequest(target.number);
      label = `#${pr.number} (${pr.headRef})`;
      sha = pr.headSha;
    } else {
      label = target.kind === 'ref' ? target.ref : repository.defaultBranch;
      sha = await client.resolveCommit(label);
    }
  } catch (error) {
    const missing = error instanceof GitHubError && (error.status === 404 || error.status === 422);
    return {
      ...ready,
      check: null,
      failure: missing ? 'revision-not-found' : 'failed',
      errors: [describeError(error)],
    };
  }

  try {
    const analysis = await d.cache.get(`${repository.fullName}@${sha}`, async () => {
      const snapshot = await d.extract(await client.downloadTarball(sha));
      try {
        const [result, setup] = await Promise.all([d.check(snapshot.root), d.setup(snapshot.root)]);
        return { result, setup, checkedAt: d.now().toISOString() };
      } finally {
        await snapshot.dispose();
      }
    });
    return {
      ...ready,
      check: { repository: repository.fullName, ref: label, target, sha, ...analysis },
      errors: [],
    };
  } catch (error) {
    return { ...ready, check: null, failure: 'failed', errors: [describeError(error)] };
  }
}
