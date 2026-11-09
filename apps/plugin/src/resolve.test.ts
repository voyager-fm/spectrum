import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { compareVersions, findRepositoryCli, PACKAGE_NAME, selectCli } from './resolve.ts';

const BUNDLED = '0.5.0';

async function sandbox(t: TestContext): Promise<string> {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'spectrum-resolve-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

/** A Spectrum package directory whose script prints its version and arguments. */
async function spectrumPackage(directory: string, version: string, name = PACKAGE_NAME) {
  await mkdir(join(directory, 'dist'), { recursive: true });
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ name, version, bin: { spectrum: 'dist/spectrum.mjs' } }),
  );
  const script = join(directory, 'dist/spectrum.mjs');
  await writeFile(script, `#!/usr/bin/env node\nconsole.log(${JSON.stringify(version)});\n`);
  await chmod(script, 0o755);
  return script;
}

function options(cwd: string, PATH = '') {
  return { cwd, env: { PATH }, bundledVersion: BUNDLED, platform: process.platform };
}

test('compareVersions orders releases and prereleases and rejects unreadable versions', () => {
  assert.equal(Math.sign(compareVersions('0.10.0', '0.9.9') ?? 0), 1);
  assert.equal(Math.sign(compareVersions('1.0.0-rc.1', '1.0.0') ?? 0), -1);
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
  assert.equal(compareVersions('latest', '1.0.0'), null);
  assert.equal(compareVersions(null, '1.0.0'), null);
});

test('the repository CLI is found from a nested directory up to the Git root', async (t) => {
  const root = await sandbox(t);
  await mkdir(join(root, '.git'));
  const script = await spectrumPackage(join(root, 'node_modules', PACKAGE_NAME), '0.6.0');
  const nested = join(root, 'packages/app/src');
  await mkdir(nested, { recursive: true });
  const { cli, notes } = selectCli(options(nested));
  assert.equal(cli?.source, 'repository');
  assert.equal(cli?.version, '0.6.0');
  assert.deepEqual(cli?.args, [script]);
  assert.deepEqual(notes, []);
});

test('a package above the Git root is not treated as the repository pin', async (t) => {
  const outer = await sandbox(t);
  await spectrumPackage(join(outer, 'node_modules', PACKAGE_NAME), '0.6.0');
  const repository = join(outer, 'repository');
  await mkdir(join(repository, '.git'), { recursive: true });
  assert.equal(findRepositoryCli(options(repository)), null);
});

test("pnpm's hidden hoist directory finds a package one workspace package installs", async (t) => {
  const root = await sandbox(t);
  await mkdir(join(root, '.git'));
  await spectrumPackage(join(root, 'node_modules/.pnpm/node_modules', PACKAGE_NAME), '0.6.0');
  assert.equal(selectCli(options(root)).cli?.source, 'repository');
});

test('a package with another name in the Spectrum path is ignored', async (t) => {
  const root = await sandbox(t);
  await mkdir(join(root, '.git'));
  await spectrumPackage(join(root, 'node_modules', PACKAGE_NAME), '9.0.0', 'spectrum');
  assert.equal(findRepositoryCli(options(root)), null);
});

test('an older repository pin still runs, with a note naming both versions', async (t) => {
  const root = await sandbox(t);
  await mkdir(join(root, '.git'));
  await spectrumPackage(join(root, 'node_modules', PACKAGE_NAME), '0.4.0');
  const { cli, notes } = selectCli(options(root));
  assert.equal(cli?.source, 'repository');
  assert.match(notes.join('\n'), /pins @voyager-fm\/spectrum 0\.4\.0; this plugin bundles 0\.5\.0/);
});

test("a Yarn Plug'n'Play project runs its declared package through yarn", {
  skip: process.platform === 'win32',
}, async (t) => {
  const root = await sandbox(t);
  await mkdir(join(root, '.git'));
  await writeFile(join(root, '.pnp.cjs'), '');
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ devDependencies: { [PACKAGE_NAME]: '0.6.0' } }),
  );
  const bin = join(root, 'bin');
  await mkdir(bin);
  await writeFile(
    join(bin, 'yarn'),
    `#!/bin/sh\n[ "$1 $2 $3" = "run spectrum --version" ] && echo "${PACKAGE_NAME} 0.6.0"\n`,
  );
  await chmod(join(bin, 'yarn'), 0o755);
  const { cli } = selectCli(options(root, bin));
  assert.equal(cli?.source, 'repository');
  assert.equal(cli?.version, '0.6.0');
  assert.deepEqual([cli?.command, ...(cli?.args ?? [])], ['yarn', 'run', 'spectrum']);

  await writeFile(join(bin, 'yarn'), '#!/bin/sh\nexit 1\n');
  const failed = selectCli(options(root, bin));
  assert.equal(failed.cli, null);
  assert.match(failed.notes.join('\n'), /did not identify it/);
});

test('a global install runs only when it is the Spectrum package and newer than the bundle', {
  skip: process.platform === 'win32',
}, async (t) => {
  const home = await sandbox(t);
  const cwd = join(home, 'work');
  await mkdir(join(cwd, '.git'), { recursive: true });
  const prefix = join(home, 'prefix');
  const bin = join(prefix, 'bin');
  await mkdir(bin, { recursive: true });
  const packageDir = join(prefix, 'lib/node_modules', PACKAGE_NAME);
  const link = async (target: string) => {
    await rm(join(bin, 'spectrum'), { force: true });
    await symlink(target, join(bin, 'spectrum'));
  };

  const script = await spectrumPackage(packageDir, '0.6.0');
  await link(script);
  const newer = selectCli(options(cwd, bin));
  assert.equal(newer.cli?.source, 'global');
  assert.deepEqual(newer.cli?.args, [script]);

  await spectrumPackage(packageDir, '0.5.0');
  const same = selectCli(options(cwd, bin));
  assert.equal(same.cli, null);
  assert.match(same.notes.join('\n'), /not newer than the bundled 0\.5\.0/);

  const unrelated = join(home, 'unrelated');
  await spectrumPackage(unrelated, '9.0.0', 'spectrum');
  await link(join(unrelated, 'dist/spectrum.mjs'));
  const other = selectCli(options(cwd, bin));
  assert.equal(other.cli, null);
  assert.match(other.notes.join('\n'), /is not the @voyager-fm\/spectrum package/);
});

test('the repository pin wins over a newer global install', {
  skip: process.platform === 'win32',
}, async (t) => {
  const home = await sandbox(t);
  const cwd = join(home, 'work');
  await mkdir(join(cwd, '.git'), { recursive: true });
  await spectrumPackage(join(cwd, 'node_modules', PACKAGE_NAME), '0.4.0');
  const bin = join(home, 'bin');
  await mkdir(bin);
  await symlink(await spectrumPackage(join(home, 'global'), '0.9.0'), join(bin, 'spectrum'));
  assert.equal(selectCli(options(cwd, bin)).cli?.source, 'repository');
});
