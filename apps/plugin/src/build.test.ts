import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { bundleCli } from './build.ts';

test('the standalone plugin bundle runs document parsers without workspace dependencies', async (t) => {
  const root = resolve(import.meta.dirname, '../../..');
  const directory = await mkdtemp(join(tmpdir(), 'spectrum-plugin-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'spectrum.mjs');
  await writeFile(path, await bundleCli());
  const result = spawnSync(process.execPath, [path, 'check', root], {
    cwd: directory,
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
    spawnSync(process.execPath, [path, ...args], { cwd: client, encoding: 'utf8' });
  const init = run(['init']);
  assert.equal(init.status, 0, init.stderr);
  assert.equal(JSON.parse(init.stdout).check.ok, true);
  assert.equal(run(['skills', 'install']).status, 0);
  assert.equal(run(['check']).status, 0);
  const manifest = JSON.parse(
    await readFile(resolve(import.meta.dirname, '../../cli/package.json'), 'utf8'),
  );
  assert.equal(run(['--version']).stdout.trim(), manifest.version);
});
