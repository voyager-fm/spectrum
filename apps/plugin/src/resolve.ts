import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { delimiter, dirname, join, relative, resolve } from 'node:path';

// Chooses which Spectrum CLI the plugin skill runs: the repository's pinned package, then a
// newer global install, then the bundled copy. Discovery reads package manifests and never runs
// an unidentified `spectrum` executable found on PATH.

export const PACKAGE_NAME = '@voyager-fm/spectrum';
const BIN = 'spectrum';

export type CliSource = 'repository' | 'global' | 'bundled';

export interface ExternalCli {
  source: 'repository' | 'global';
  /** null when the version could not be read. */
  version: string | null;
  command: string;
  args: string[];
  /** Where the CLI was found, for the message that names the CLI that ran. */
  location: string;
}

export interface Selection {
  cli: ExternalCli | null;
  /** Notes for stderr: which CLI runs and why another was skipped. */
  notes: string[];
}

export interface ResolveOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  bundledVersion: string;
  platform?: NodeJS.Platform;
  execPath?: string;
}

type Version = [number, number, number, string];

function parseVersion(value: string | null): Version | null {
  const match = value ? /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value) : null;
  return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] ?? ''] : null;
}

/** Semver precedence for release and prerelease versions; null when either is unreadable. */
export function compareVersions(a: string | null, b: string | null): number | null {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return null;
  for (let index = 0; index < 3; index++)
    if (x[index] !== y[index]) return (x[index] as number) - (y[index] as number);
  if (x[3] === y[3]) return 0;
  if (!x[3]) return 1;
  if (!y[3]) return -1;
  return x[3] < y[3] ? -1 : 1;
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    return typeof value === 'object' && value !== null ? value : null;
  } catch {
    return null;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** The package's executable script, when `directory` holds the Spectrum package. */
function packageScript(directory: string): { script: string; version: string | null } | null {
  const manifest = readJson(join(directory, 'package.json'));
  if (manifest?.name !== PACKAGE_NAME) return null;
  const bin = manifest.bin;
  const target =
    typeof bin === 'string'
      ? bin
      : typeof bin === 'object' && bin !== null
        ? (bin as Record<string, unknown>)[BIN]
        : undefined;
  if (typeof target !== 'string') return null;
  const script = resolve(directory, target);
  if (!isFile(script)) return null;
  return { script, version: typeof manifest.version === 'string' ? manifest.version : null };
}

/** The working directory and its ancestors up to the nearest Git root, nearest first. */
function repositoryDirectories(cwd: string): string[] {
  const directories: string[] = [];
  for (let directory = resolve(cwd); ; directory = dirname(directory)) {
    directories.push(directory);
    if (existsSync(join(directory, '.git'))) return directories;
    if (dirname(directory) === directory) return [resolve(cwd)];
  }
}

function declaresPackage(directory: string): boolean {
  const manifest = readJson(join(directory, 'package.json'));
  return ['dependencies', 'devDependencies', 'optionalDependencies'].some((field) => {
    const deps = manifest?.[field];
    return typeof deps === 'object' && deps !== null && Object.hasOwn(deps, PACKAGE_NAME);
  });
}

function versionFromOutput(stdout: string): string | null {
  const words = stdout.trim().split(/\s+/);
  if (words.length === 2 && words[0] === PACKAGE_NAME) return words[1];
  return words.length === 1 && parseVersion(words[0]) ? words[0] : null;
}

function display(cwd: string, path: string): string {
  const relativePath = relative(cwd, path);
  return relativePath && !relativePath.startsWith('..') ? relativePath : path;
}

/**
 * The repository's pinned package, searched from the working directory up to the Git root:
 * `node_modules/@voyager-fm/spectrum` (npm, Yarn classic and hoisted workspaces), pnpm's hidden
 * hoist directory (pnpm workspaces that install it in one package), then Yarn Plug'n'Play
 * through `yarn run`.
 */
export function findRepositoryCli(
  options: ResolveOptions,
  notes: string[] = [],
): ExternalCli | null {
  const execPath = options.execPath ?? process.execPath;
  for (const directory of repositoryDirectories(options.cwd)) {
    for (const modules of [
      join(directory, 'node_modules'),
      join(directory, 'node_modules', '.pnpm', 'node_modules'),
    ]) {
      const found = packageScript(join(modules, PACKAGE_NAME));
      if (found)
        return {
          source: 'repository',
          version: found.version,
          command: execPath,
          args: [found.script],
          location: display(options.cwd, join(modules, PACKAGE_NAME)),
        };
    }
    if (isFile(join(directory, '.pnp.cjs')) && declaresPackage(directory)) {
      const yarn = options.platform === 'win32' ? 'yarn.cmd' : 'yarn';
      const probe = spawnSync(yarn, ['run', BIN, '--version'], {
        cwd: options.cwd,
        env: options.env,
        encoding: 'utf8',
        shell: options.platform === 'win32',
      });
      const version = probe.status === 0 ? versionFromOutput(probe.stdout) : null;
      if (version)
        return {
          source: 'repository',
          version,
          command: yarn,
          args: ['run', BIN],
          location: `Yarn Plug'n'Play project ${display(options.cwd, directory) || '.'}`,
        };
      notes.push(
        `${display(options.cwd, directory) || '.'} declares ${PACKAGE_NAME} with Yarn Plug'n'Play, ` +
          "but 'yarn run spectrum --version' did not identify it; skipping it.",
      );
    }
  }
  return null;
}

/**
 * The first `spectrum` on PATH, accepted only when its manifest identifies the Spectrum package.
 * Symlinked installs (npm, pnpm, nvm, Homebrew) resolve to the package script; Windows `.cmd`
 * shims resolve through the prefix's `node_modules`.
 */
export function findGlobalCli(options: ResolveOptions, notes: string[] = []): ExternalCli | null {
  const execPath = options.execPath ?? process.execPath;
  const windows = options.platform === 'win32';
  const pathValue = options.env.PATH ?? options.env.Path ?? '';
  for (const entry of pathValue.split(windows ? ';' : delimiter)) {
    if (!entry) continue;
    const shim = join(entry, windows ? `${BIN}.cmd` : BIN);
    if (!isFile(shim)) continue;
    const candidates = windows
      ? [join(entry, 'node_modules', PACKAGE_NAME)]
      : (() => {
          const real = dirname(realpathSync(shim));
          return [real, dirname(real), dirname(dirname(real))];
        })();
    for (const directory of candidates) {
      const found = packageScript(directory);
      if (found)
        return {
          source: 'global',
          version: found.version,
          command: execPath,
          args: [found.script],
          location: shim,
        };
    }
    notes.push(`Skipped ${shim}; it is not the ${PACKAGE_NAME} package.`);
    return null;
  }
  return null;
}

export function selectCli(options: ResolveOptions): Selection {
  const notes: string[] = [];
  const bundled = options.bundledVersion;
  const repository = findRepositoryCli(options, notes);
  if (repository) {
    const order = compareVersions(repository.version, bundled);
    if (order === null || order < 0)
      notes.push(
        `The repository pins ${PACKAGE_NAME} ${repository.version ?? '(unknown version)'}; ` +
          `this plugin bundles ${bundled}. Update the repository's package to use newer commands.`,
      );
    return { cli: repository, notes };
  }
  const global = findGlobalCli(options, notes);
  if (global) {
    const order = compareVersions(global.version, bundled);
    if (order !== null && order > 0) return { cli: global, notes };
    notes.push(
      `Skipped the global ${PACKAGE_NAME} ${global.version ?? '(unknown version)'} at ` +
        `${global.location}; it is not newer than the bundled ${bundled}.`,
    );
  }
  return { cli: null, notes };
}

/** One stderr line naming the CLI that ran. */
export function describe(cli: ExternalCli | null, bundledVersion: string): string {
  if (!cli) return `spectrum: ran the bundled CLI ${PACKAGE_NAME} ${bundledVersion}`;
  return `spectrum: ran the ${cli.source} CLI ${PACKAGE_NAME} ${cli.version ?? '(unknown version)'} from ${cli.location}`;
}
