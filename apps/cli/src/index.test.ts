import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
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

async function emptyRepository(t: { after: (fn: () => Promise<void>) => void }) {
  const directory = await mkdtemp(join(tmpdir(), 'spectrum-client-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('init writes a starter bundle that passes the checker and refuses a second run', async (t) => {
  const directory = await emptyRepository(t);
  const dry = cli(['init', directory, '--dry-run']);
  assert.equal(dry.status, 0, dry.stderr);
  const plan = JSON.parse(dry.stdout);
  assert.ok(plan.files.includes('.spectrum/config.json'));
  assert.deepEqual(await readdir(directory), [], 'a dry run writes nothing');

  const init = cli(['init', directory, '--name', 'Demo "client"']);
  assert.equal(init.status, 0, init.stderr);
  const result = JSON.parse(init.stdout);
  assert.deepEqual(result.files, plan.files);
  assert.equal(result.check.ok, true);
  assert.ok(result.check.warnings > 0, 'undecided starter values stay visible as warnings');
  const config = JSON.parse(await readFile(join(directory, '.spectrum/config.json'), 'utf8'));
  assert.equal(config.name, 'Demo "client"');
  assert.equal(cli(['check', directory]).status, 0);

  await writeFile(join(directory, '.spectrum/overview.md'), 'edited');
  const again = cli(['init', directory]);
  assert.equal(again.status, 1);
  assert.ok(JSON.parse(again.stdout).conflicts.includes('.spectrum/config.json'));
  assert.equal(await readFile(join(directory, '.spectrum/overview.md'), 'utf8'), 'edited');
});

test('init writes nothing when any starter path already exists', async (t) => {
  const directory = await emptyRepository(t);
  await mkdir(join(directory, '.spectrum/rules'), { recursive: true });
  await writeFile(join(directory, '.spectrum/rules/agents.md'), 'existing rules');
  const result = cli(['init', directory]);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).conflicts, ['.spectrum/rules/agents.md']);
  assert.deepEqual(await readdir(join(directory, '.spectrum')), ['rules']);
});

test('init refuses to write through a link that leaves the repository', async (t) => {
  const directory = await emptyRepository(t);
  const outside = await emptyRepository(t);
  await symlink(outside, join(directory, '.spectrum'));
  const result = cli(['init', directory]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /outside the repository/);
  assert.deepEqual(await readdir(outside), []);
});

test('skills install creates, keeps and updates managed skills but never replaces foreign files', async (t) => {
  const directory = await emptyRepository(t);
  const claude = join(directory, '.claude/skills/spectrum/SKILL.md');
  const codex = join(directory, '.agents/skills/spectrum/SKILL.md');
  const outcomes = (args: string[]) => {
    const result = cli(['skills', 'install', directory, ...args]);
    return { status: result.status, skills: JSON.parse(result.stdout).skills };
  };
  const first = outcomes([]);
  assert.equal(first.status, 0);
  assert.deepEqual(
    first.skills.map((skill: { outcome: string }) => skill.outcome),
    ['created', 'created'],
  );
  const installed = await readFile(claude, 'utf8');
  assert.match(installed, /^---\nname: spectrum\n/);
  assert.match(installed, /Generated by @voyager-fm\/spectrum \d+\.\d+\.\d+;/);
  assert.match(installed, /node_modules\/\.bin\/spectrum check/);
  assert.equal(await readFile(codex, 'utf8'), installed);

  assert.deepEqual(
    outcomes([]).skills.map((skill: { outcome: string }) => skill.outcome),
    ['unchanged', 'unchanged'],
  );
  await writeFile(claude, installed.replace('# Spectrum', '# Old Spectrum'));
  assert.equal(outcomes(['--agent', 'claude']).skills[0].outcome, 'updated');
  assert.equal(await readFile(claude, 'utf8'), installed);

  await writeFile(codex, 'my own skill');
  await rm(claude);
  const conflict = outcomes([]);
  assert.equal(conflict.status, 1);
  assert.equal(conflict.skills[1].outcome, 'conflict');
  assert.equal(await readFile(codex, 'utf8'), 'my own skill');
  await assert.rejects(readFile(claude, 'utf8'), 'a conflict writes no other skill');

  assert.equal(outcomes(['--force']).status, 0);
  assert.equal(await readFile(codex, 'utf8'), installed);
});

test('CLI rejects unknown options and agents and reports its version', async (t) => {
  const directory = await emptyRepository(t);
  assert.equal(cli(['init', directory, '--profile', 'x.json']).status, 1);
  assert.equal(cli(['skills', 'install', directory, '--agent', 'other']).status, 1);
  assert.equal(cli(['skills']).status, 2);
  assert.equal(cli(['init', directory, '--name']).status, 1);
  assert.deepEqual(await readdir(directory), []);
  const version = cli(['--version']);
  assert.equal(version.status, 0);
  const manifest = JSON.parse(await readFile(join(root, 'apps/cli/package.json'), 'utf8'));
  assert.equal(version.stdout.trim(), manifest.version);
});
