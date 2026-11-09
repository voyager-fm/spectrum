import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../../..');
const entry = resolve(import.meta.dirname, 'index.ts');
function cli(args: string[], cwd = root) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

test('CLI check and list expose the same canonical interaction model', () => {
  const check = cli(['check']);
  const list = cli(['list']);
  assert.equal(check.status, 0, check.stderr);
  assert.equal(list.status, 0, list.stderr);
  const result = JSON.parse(check.stdout);
  assert.deepEqual(JSON.parse(list.stdout), result.specs);
  assert.ok(result.model.relationships.length > 0);
  assert.equal(result.config.schema_version, 2);
});

test('CLI profile reads an existing repository without installing a config', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'spectrum-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(join(root, '.spectrum'), join(directory, '.spectrum'), { recursive: true });
  await rename(join(directory, '.spectrum/config.json'), join(directory, 'profile.json'));
  const result = cli(['check', directory, '--profile', join(directory, 'profile.json')]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).ok, true);
  assert.equal(cli(['check', directory]).status, 1);
});

test('CLI distinguishes structural failures and unsupported commands', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'spectrum-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'invalid.json'), '{"schemaVersion":1}');
  const result = cli(['check', directory, '--profile', join(directory, 'invalid.json')]);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).findings[0].code, 'invalid-config');
  assert.equal(cli(['unknown']).status, 2);
  assert.equal(cli(['check', '--profile']).status, 1);
});

test('CLI rejects unreadable and malformed profiles before checking', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'spectrum-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'malformed.json'), '{ not json');
  for (const profile of [join(directory, 'missing.json'), join(directory, 'malformed.json')]) {
    const result = cli(['check', directory, '--profile', profile]);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
  }
});
