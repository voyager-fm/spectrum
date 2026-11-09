import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { CheckResult } from '../../../../packages/core/src/index.ts';
import { checkRepository } from '../../../../packages/spec-engine/src/index.ts';

const run = promisify(execFile);

export interface RepositoryState {
  name: string;
  revision: string | null;
  /** null when Git state could not be read. */
  dirty: boolean | null;
}

export interface ConfigSummary {
  mode: string;
  canonicalSource: string;
  github: boolean;
  linear: boolean;
  agents: boolean;
}

export interface SpecDocument {
  path: string;
  title: string;
  body: string;
}

export interface DashboardSnapshot {
  repository: RepositoryState;
  config: ConfigSummary | null;
  check: CheckResult | null;
  /** Load failures are reported, never replaced with sample data. */
  errors: string[];
  overview: SpecDocument | null;
  rules: SpecDocument[];
  contracts: SpecDocument[];
  flows: SpecDocument[];
}

/** Repository whose .spectrum directory the dashboard reads. Defaults to this monorepo. */
export function repositoryRoot(): string {
  // Read at request time from any local repository; never bundle or trace it.
  return resolve(/*turbopackIgnore: true*/ process.env.SPECTRUM_REPOSITORY ?? resolve(process.cwd(), '../..'));
}

async function git(root: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run('git', args, { cwd: root, timeout: 5_000 });
    return stdout;
  } catch {
    return null;
  }
}

export async function readRepositoryState(root: string): Promise<RepositoryState> {
  const revision = (await git(root, ['rev-parse', 'HEAD']))?.trim() || null;
  const status = revision ? await git(root, ['status', '--porcelain']) : null;
  return { name: basename(root), revision, dirty: status === null ? null : status.trim().length > 0 };
}

function titleOf(path: string, body: string): string {
  const heading = /^#\s+(.+)$/m.exec(body);
  return heading ? heading[1].trim() : basename(path);
}

export async function readDocument(root: string, path: string): Promise<SpecDocument> {
  const body = await readFile(resolve(root, path), 'utf8');
  return { path, title: titleOf(path, body), body };
}

export async function readDocuments(root: string, dir: string): Promise<SpecDocument[]> {
  let entries;
  try {
    entries = await readdir(resolve(root, '.spectrum', dir), { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  const docs: SpecDocument[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !/\.(md|toml)$/.test(entry.name)) continue;
    docs.push(await readDocument(root, `.spectrum/${dir}/${entry.name}`));
  }
  return docs;
}

export async function readConfig(root: string): Promise<ConfigSummary> {
  const raw = JSON.parse(await readFile(resolve(root, '.spectrum/config.json'), 'utf8'));
  return {
    mode: String(raw.mode ?? 'unknown'),
    canonicalSource: String(raw.canonicalSource ?? 'unknown'),
    github: raw.integrations?.github?.enabled === true,
    linear: raw.integrations?.linear?.enabled === true,
    agents: raw.agents?.enabled === true,
  };
}

async function attempt<T>(label: string, errors: string[], load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (e) {
    errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    return fallback;
  }
}

export async function loadDashboard(root: string = repositoryRoot()): Promise<DashboardSnapshot> {
  const errors: string[] = [];
  const [repository, config, check, overview, rules, contracts, flows] = await Promise.all([
    readRepositoryState(root),
    attempt('config', errors, () => readConfig(root), null),
    attempt('spec check', errors, () => checkRepository(root), null),
    attempt('overview', errors, () => readDocument(root, '.spectrum/overview.md'), null),
    attempt('rules', errors, () => readDocuments(root, 'rules'), []),
    attempt('contracts', errors, () => readDocuments(root, 'contracts'), []),
    attempt('flows', errors, () => readDocuments(root, 'flows'), []),
  ]);
  return { repository, config, check, errors, overview, rules, contracts, flows };
}
