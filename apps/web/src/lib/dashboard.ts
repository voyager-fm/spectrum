import { execFile } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { CheckResult } from '@spectrum/core';
import { checkRepository } from '@spectrum/spec-engine';

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
  documents: SpecDocument[];
}

/** Repository whose .spectrum directory the dashboard reads. Defaults to this monorepo. */
export function repositoryRoot(): string {
  // Read at request time from any local repository; never bundle or trace it.
  return resolve(
    /*turbopackIgnore: true*/ process.env.SPECTRUM_REPOSITORY ?? resolve(process.cwd(), '../..'),
  );
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
  return {
    name: basename(root),
    revision,
    dirty: status === null ? null : status.trim().length > 0,
  };
}

async function attempt<T>(
  label: string,
  errors: string[],
  load: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await load();
  } catch (e) {
    errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    return fallback;
  }
}

export async function loadDashboard(root: string = repositoryRoot()): Promise<DashboardSnapshot> {
  const errors: string[] = [];
  const [repository, result] = await Promise.all([
    readRepositoryState(root),
    attempt('spec check', errors, () => checkRepository(root), null),
  ]);
  const raw = result?.config;
  if (!raw) {
    errors.push('config: No valid repository source mapping.');
    if (result) errors.push(...result.findings.map((f) => `spec check: ${f.message}`));
  }
  if (raw && result) {
    const loadFailures = new Set([
      'missing-file',
      'invalid-document',
      'invalid-contract',
      'invalid-inventory',
    ]);
    errors.push(
      ...result.findings
        .filter((f) => loadFailures.has(f.code))
        .map((f) => `${f.path}: ${f.message}`),
    );
  }
  const config: ConfigSummary | null = raw
    ? {
        mode: raw.mode,
        canonicalSource: raw.canonical_source,
      }
    : null;
  const check = raw ? result : null;
  const documents = check?.model.documents ?? [];
  return {
    repository,
    config,
    check,
    errors,
    documents,
    overview: documents.find((doc) => doc.kind === 'overview') ?? null,
    rules: documents.filter((doc) => doc.kind === 'rule'),
    contracts: documents.filter((doc) => doc.kind === 'contract' || doc.kind === 'page_contract'),
    flows: documents.filter((doc) => doc.kind === 'flow'),
  };
}
