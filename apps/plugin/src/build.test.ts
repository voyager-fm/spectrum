import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { bundleCli } from './build.ts';

// The launcher looks for a global `spectrum` on PATH; keep these runs independent of the machine.
const HERMETIC = { ...process.env, PATH: '' };

test('the standalone plugin bundle runs document parsers without workspace dependencies', async (t) => {
  const root = resolve(import.meta.dirname, '../../..');
  const directory = await mkdtemp(join(tmpdir(), 'spectrum-plugin-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'spectrum.mjs');
  await writeFile(path, await bundleCli());
  const result = spawnSync(process.execPath, [path, 'check', root], {
    cwd: directory,
    env: HERMETIC,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  const check = JSON.parse(result.stdout);
  assert.equal(check.ok, true);
  assert.equal(check.config.schema_version, 2);
  assert.ok(check.model.documents.some((doc: { kind: string }) => doc.kind === 'contract'));
  assert.ok(check.specs.some((spec: { id: string }) => spec.id === 'VAL-001-check_repository'));
});

test('the standalone bundle initializes a repository from its embedded templates', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'spectrum-plugin-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'spectrum.mjs');
  await writeFile(path, await bundleCli());
  const client = join(directory, 'client');
  await mkdir(client);
  const run = (args: string[]) =>
    spawnSync(process.execPath, [path, ...args], { cwd: client, env: HERMETIC, encoding: 'utf8' });
  const init = run(['init']);
  assert.equal(init.status, 0, init.stderr);
  assert.equal(JSON.parse(init.stdout).check.ok, true);
  assert.equal(run(['skills', 'install']).status, 0);
  assert.equal(run(['check']).status, 0);
  const manifest = JSON.parse(
    await readFile(resolve(import.meta.dirname, '../../cli/package.json'), 'utf8'),
  );
  const version = run(['--version']);
  assert.equal(version.stdout.trim(), `@voyager-fm/spectrum ${manifest.version}`);
  assert.match(version.stderr, /ran the bundled CLI @voyager-fm\/spectrum/);
});

/** A repository pinning a fake Spectrum package that prints its arguments, or rejects `status`. */
async function pinnedRepository(directory: string, version: string): Promise<string> {
  const repository = join(directory, 'repository');
  const pkg = join(repository, 'node_modules/@voyager-fm/spectrum');
  await mkdir(join(repository, '.git'), { recursive: true });
  await mkdir(join(pkg, 'dist'), { recursive: true });
  await writeFile(
    join(pkg, 'package.json'),
    JSON.stringify({ name: '@voyager-fm/spectrum', version, bin: { spectrum: 'dist/cli.mjs' } }),
  );
  await writeFile(
    join(pkg, 'dist/cli.mjs'),
    [
      'const args = process.argv.slice(2);',
      "if (args[0] === 'status') { console.log('Usage: spectrum'); process.exit(2); }",
      `console.log(JSON.stringify({ pinned: ${JSON.stringify(version)}, args }));`,
    ].join('\n'),
  );
  await chmod(join(pkg, 'dist/cli.mjs'), 0o755);
  return repository;
}

test('the plugin bundle runs the repository-pinned CLI and names it on stderr', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'spectrum-plugin-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'spectrum.mjs');
  await writeFile(path, await bundleCli());
  const repository = await pinnedRepository(directory, '99.0.0');
  const result = spawnSync(process.execPath, [path, 'check', '--profile', 'p.json'], {
    cwd: repository,
    env: HERMETIC,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    pinned: '99.0.0',
    args: ['check', '--profile', 'p.json'],
  });
  assert.match(
    result.stderr,
    /ran the repository CLI @voyager-fm\/spectrum 99\.0\.0 from node_modules\/@voyager-fm\/spectrum/,
  );
});

test('an older pinned CLI that rejects a command falls back to the bundled CLI', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'spectrum-plugin-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'spectrum.mjs');
  await writeFile(path, await bundleCli());
  const repository = await pinnedRepository(directory, '0.0.1');
  const run = (args: string[]) =>
    spawnSync(process.execPath, [path, ...args], {
      cwd: repository,
      env: HERMETIC,
      encoding: 'utf8',
    });

  const check = run(['check']);
  assert.equal(JSON.parse(check.stdout).pinned, '0.0.1');
  assert.match(check.stderr, /pins @voyager-fm\/spectrum 0\.0\.1; this plugin bundles/);

  const status = run(['status']);
  assert.equal(typeof JSON.parse(status.stdout).ready, 'boolean');
  assert.match(status.stderr, /CLI 0\.0\.1 does not accept this command; running the bundled/);
  assert.match(status.stderr, /ran the bundled CLI/);
});

test('standalone output formats work without workspace files and preserve error exit codes', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'spectrum-output-bundle-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const binary = join(directory, 'spectrum.mjs');
  await writeFile(binary, await bundleCli());
  const client = join(directory, 'client');
  await mkdir(client);
  const run = (args: string[]) =>
    spawnSync(process.execPath, [binary, ...args], {
      cwd: client,
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    });
  const missing = run(['check', '--format', 'github']);
  assert.equal(missing.status, 1, missing.stderr);
  assert.match(missing.stdout, /^::error .*file=\.spectrum\/config\.json::/m);
  assert.equal(run(['init']).status, 0);
  const json = run(['check']);
  assert.equal(json.status, 0, json.stderr);
  assert.deepEqual(JSON.parse(run(['check', '--format', 'json']).stdout), JSON.parse(json.stdout));
  const text = run(['check', '--format', 'text']);
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /^Structural check: PASS/);
  const list = run(['list', '--format', 'text']);
  assert.equal(list.status, 0, list.stderr);
  assert.match(list.stdout, /execution verification: not recorded/);
  const github = run(['check', '--format', 'github']);
  assert.equal(github.status, 0, github.stderr);
  assert.match(github.stdout, /^::warning /m);
});
