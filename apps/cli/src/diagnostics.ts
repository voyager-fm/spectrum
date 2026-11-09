import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { checkRepository } from '@spectrum/spec-engine';
import {
  inspectRepositorySetup,
  type RepositorySetup,
  SETUP,
  SETUP_COMMANDS,
  skillVersion,
} from '@spectrum/spec-engine/setup';

export interface DiagnosticsOptions {
  mode?: 'status' | 'doctor';
  cliVersion?: string;
  cliPath?: string;
  /** Caller evidence, not inferred from a repository setting or executable filename. */
  cliSource?: 'repository' | 'plugin' | 'unknown';
}

export interface DiagnosticIssue {
  code: string;
  severity: 'warning' | 'error';
  path: string;
  message: string;
}

export interface DiagnosticsResult {
  root: string;
  mode: 'status' | 'doctor';
  cli: { version: string | null; path: string | null; source: 'repository' | 'plugin' | 'unknown' };
  setup: RepositorySetup;
  package: {
    declaredRange: string | null;
    installedVersion: string | null;
    installedPath: string;
    state: 'observed' | 'missing' | 'invalid';
  };
  evidence: { path: string; description: string }[];
  issues: DiagnosticIssue[];
  check: {
    status: 'notRun' | 'passed' | 'failed' | 'blocked';
    reason: string | null;
    errors: number;
    warnings: number;
  };
  ready: boolean;
  next: string[];
}

type FileEvidence =
  | { state: 'file'; content: string }
  | { state: 'missing'; detail: string }
  | { state: 'invalid'; detail: string };

/** Fixed bounded reads only. No binary execution, traversal, or external symlink reads. */
async function boundedFile(root: string, path: string): Promise<FileEvidence> {
  try {
    const target = join(root, path);
    const stat = await lstat(target);
    if (!stat.isFile() || stat.size > 1024 * 1024)
      return { state: 'invalid', detail: 'not a bounded regular file (links are not followed)' };
    const rel = relative(await realpath(root), await realpath(target));
    if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`))
      return { state: 'invalid', detail: 'resolves outside the repository root' };
    return { state: 'file', content: await readFile(target, 'utf8') };
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? { state: 'missing', detail: 'file not found' }
      : { state: 'invalid', detail: 'file cannot be inspected' };
  }
}

function object(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Read-only status; doctor additionally executes the real repository checker when possible. */
export async function repositoryDiagnostics(
  root: string,
  options: DiagnosticsOptions = {},
): Promise<DiagnosticsResult> {
  root = resolve(root);
  const setup = await inspectRepositorySetup(root);
  const installedPath = `node_modules/${SETUP.packageName}/package.json`;
  const result: DiagnosticsResult = {
    root,
    mode: options.mode ?? 'status',
    cli: {
      version: options.cliVersion ?? null,
      path: options.cliPath ?? null,
      source: options.cliSource ?? 'unknown',
    },
    setup,
    package: {
      declaredRange: setup.package.state === 'ok' ? setup.package.detail : null,
      installedVersion: null,
      installedPath,
      state: 'missing',
    },
    evidence: [],
    issues: [],
    check: {
      status: 'notRun',
      reason: 'Status does not run repository checks.',
      errors: 0,
      warnings: 0,
    },
    ready: false,
    next: [],
  };
  const issue = (code: string, severity: 'warning' | 'error', path: string, message: string) =>
    result.issues.push({ code, severity, path, message });
  const next = (command: string) => {
    if (!result.next.includes(command)) result.next.push(command);
  };
  try {
    if (!(await lstat(root)).isDirectory()) throw new Error('Not a directory');
  } catch {
    issue('invalid-root', 'error', root, 'Repository root must be an existing directory.');
  }

  const config = await boundedFile(root, SETUP.config);
  if (config.state === 'invalid') {
    setup.config.state = 'invalid';
    setup.config.detail = config.detail;
  }
  if (setup.config.state !== 'ok') {
    issue(
      'config-unavailable',
      'error',
      SETUP.config,
      setup.config.detail ?? 'Configuration is missing.',
    );
    if (setup.config.state === 'missing') next(SETUP_COMMANDS.init);
  } else {
    result.evidence.push({
      path: SETUP.config,
      description:
        'JSON configuration declares schema_version 2; status does not validate its source mappings.',
    });
  }

  const installed = await boundedFile(root, installedPath);
  if (installed.state === 'file') {
    const manifest = object(installed.content);
    if (
      manifest?.name === SETUP.packageName &&
      typeof manifest.version === 'string' &&
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(manifest.version)
    ) {
      result.package.state = 'observed';
      result.package.installedVersion = manifest.version;
      result.evidence.push({
        path: installedPath,
        description: `Package manifest reports ${manifest.version}; the local binary was not executed or verified.`,
      });
      if (options.cliVersion && manifest.version !== options.cliVersion)
        issue(
          'installed-cli-version-mismatch',
          'warning',
          installedPath,
          `Installed manifest reports ${manifest.version}; active CLI reports ${options.cliVersion}.`,
        );
    } else result.package.state = 'invalid';
  } else result.package.state = installed.state;
  if (setup.package.state === 'ok')
    result.evidence.push({
      path: setup.package.path,
      description: `Declared package range: ${setup.package.detail}. This is not an observed installed version.`,
    });
  if (result.package.state !== 'observed') {
    issue(
      'local-package-unverified',
      options.cliSource === 'plugin' ? 'warning' : 'error',
      installedPath,
      result.package.state === 'missing'
        ? 'Repository-local package manifest is missing; no installed version was observed.'
        : 'Repository-local package manifest is invalid, unsafe, or unreadable.',
    );
    if (options.cliSource !== 'plugin') next(SETUP_COMMANDS.install);
  }
  if (setup.package.state !== 'ok') {
    issue(
      'package-declaration-unavailable',
      'warning',
      setup.package.path,
      setup.package.detail ?? 'Package declaration is unavailable.',
    );
    if (options.cliSource !== 'plugin') next(SETUP_COMMANDS.install);
  }

  // Plugin settings alone do not establish a repository-local executable command.
  if (setup.config.state === 'ok' && result.package.state === 'observed')
    next(SETUP_COMMANDS.check);

  let managedSkill = false;
  for (const [agent, path] of Object.entries(SETUP.skills)) {
    const file = await boundedFile(root, path);
    if (file.state === 'missing') continue; // Unused hosts are not structural failures.
    if (file.state === 'invalid') {
      issue('skill-unreadable', 'warning', path, file.detail);
      continue;
    }
    const version = skillVersion(file.content);
    if (!file.content.includes(SETUP.skillMarker)) {
      issue(
        'skill-unmanaged',
        'warning',
        path,
        'Existing skill has no Spectrum provenance marker; review ownership before replacing it.',
      );
      continue;
    }
    managedSkill = true;
    result.evidence.push({
      path,
      description: `${agent} skill marker reports ${version ?? 'no parseable version'}; file presence does not prove host loading.`,
    });
    if (!version || (options.cliVersion && version !== options.cliVersion)) {
      issue(
        'skill-version-mismatch',
        'warning',
        path,
        `Skill marker version ${version ?? 'unknown'} differs from active CLI ${options.cliVersion ?? 'unknown'}.`,
      );
      next(SETUP_COMMANDS.skills);
    }
  }
  if (setup.plugin.state === 'ok')
    result.evidence.push({
      path: SETUP.claudeSettings,
      description:
        'Repository settings declare the plugin enabled; installation, loading, and bundled CLI version are not verified.',
    });
  else if (setup.plugin.state === 'invalid')
    issue(
      'plugin-settings-invalid',
      'warning',
      SETUP.claudeSettings,
      setup.plugin.detail ?? 'Invalid plugin settings.',
    );
  if (!managedSkill && setup.plugin.state !== 'ok' && options.cliSource !== 'plugin') {
    issue(
      'agent-integration-unobserved',
      'warning',
      dirname(SETUP.skills.claude),
      'No managed repository skill or plugin enablement declaration was observed.',
    );
    next(SETUP_COMMANDS.skills);
  }
  if (options.cliSource === 'plugin')
    result.evidence.push({
      path: options.cliPath ?? '(not supplied)',
      description:
        'Caller identifies the active CLI as plugin-bundled; repository-local package is optional on this path. Host loading is not independently verified.',
    });

  if (result.mode === 'doctor') {
    if (setup.config.state !== 'ok') {
      result.check.reason =
        'Configuration is missing, invalid, or unsafe; repository check was not run.';
    } else {
      try {
        const checked = await checkRepository(root);
        result.check = {
          status: checked.ok ? 'passed' : 'failed',
          reason: null,
          errors: checked.findings.filter((finding) => finding.severity === 'error').length,
          warnings: checked.findings.filter((finding) => finding.severity === 'warning').length,
        };
        for (const finding of checked.findings)
          issue(finding.code, finding.severity, finding.path, finding.message);
      } catch {
        result.check = {
          status: 'blocked',
          reason: 'Repository checker could not inspect the root.',
          errors: 0,
          warnings: 0,
        };
        issue('check-blocked', 'error', root, result.check.reason ?? 'Repository check blocked.');
      }
    }
  }
  result.ready = !result.issues.some((entry) => entry.severity === 'error');
  return result;
}

/** Proposed CLI semantics: warnings alone do not fail; errors or a failed/blocked check do. */
export function diagnosticsExitCode(result: DiagnosticsResult): 0 | 1 {
  return result.ready && !['failed', 'blocked'].includes(result.check.status) ? 0 : 1;
}

export function renderDiagnostics(result: DiagnosticsResult): string {
  const lines = [
    `Spectrum ${result.mode}: ${result.ready ? 'ready' : 'attention required'}`,
    `Root: ${result.root}`,
    `Active CLI: ${result.cli.version ?? 'unknown'} (${result.cli.source})${result.cli.path ? ` at ${result.cli.path}` : ''}`,
    `Package: declared ${result.package.declaredRange ?? 'none'}; observed installed ${result.package.installedVersion ?? 'not verified'}`,
    `Configuration: ${result.setup.config.state}`,
    `Repository check: ${result.check.status}${result.check.reason ? ` — ${result.check.reason}` : ''}`,
    ...result.evidence.map((entry) => `Evidence: ${entry.path} — ${entry.description}`),
    ...result.issues.map(
      (entry) => `${entry.severity.toUpperCase()} ${entry.code}: ${entry.path} — ${entry.message}`,
    ),
    ...result.next.map((command) => `Next: ${command}`),
  ];
  return lines.join('\n');
}
