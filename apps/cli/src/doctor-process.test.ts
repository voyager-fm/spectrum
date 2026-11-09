import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { SETUP } from '@spectrum/spec-engine/setup';
import { bundleCli } from './bundle.ts';
import { VERSION } from './version.ts';

for (const standalone of [false, true])
  test(`doctor reports actual checks without repairs (${standalone ? 'standalone' : 'source'})`, async (t) => {
    const base = await mkdtemp(join(tmpdir(), 'spectrum-doctor-process-'));
    t.after(() => rm(base, { recursive: true, force: true }));
    const root = join(base, 'client');
    await mkdir(root);
    const binary = standalone ? join(base, 'spectrum.mjs') : join(import.meta.dirname, 'index.ts');
    if (standalone) await writeFile(binary, await bundleCli('doctor-process.test.ts'));
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [binary, ...args], { cwd: root, encoding: 'utf8' });
    const empty = run('doctor');
    assert.equal(empty.status, 1, empty.stderr);
    assert.equal(JSON.parse(empty.stdout).check.status, 'notRun');
    assert.deepEqual(await readdir(root), []);
    assert.equal(run('doctor', '--format', 'github').status, 1);
    assert.equal(run('init').status, 0);
    const packageDir = join(root, 'node_modules', SETUP.packageName);
    await mkdir(packageDir, { recursive: true });
    await writeFile(
      join(packageDir, 'package.json'),
      JSON.stringify({ name: SETUP.packageName, version: VERSION }),
    );
    const before = await readFile(join(root, SETUP.config), 'utf8');
    const json = run('doctor');
    assert.equal(json.status, 0, json.stderr);
    const result = JSON.parse(json.stdout);
    assert.equal(result.check.status, 'passed');
    assert.equal(result.cli.source, 'unknown');
    const text = run('doctor', '--format', 'text');
    assert.equal(text.status, 0, text.stderr);
    assert.match(text.stdout, /Repository check: passed/);
    assert.equal(await readFile(join(root, SETUP.config), 'utf8'), before);
    const status = JSON.parse(run('status').stdout);
    assert.equal(status.setup.config.state, 'ok');
    assert.equal(typeof status.ready, 'boolean');
  });
