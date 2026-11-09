import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkRepository } from './index.ts';
import { inspectRepositorySetup, renderStarterBundle, SETUP, skillVersion } from './setup.ts';

async function repository(t: { after: (fn: () => Promise<void>) => void }) {
  const directory = await mkdtemp(join(tmpdir(), 'spectrum-setup-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function put(root: string, path: string, content: string) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), content);
}

test('the starter bundle renders a connected repository with undecided values as warnings', async (t) => {
  const directory = await repository(t);
  const files = await renderStarterBundle('Example');
  assert.equal(new Set(files.map((file) => file.path)).size, files.length);
  for (const file of files) await put(directory, file.path, file.content);
  const result = await checkRepository(directory);
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.ok(result.findings.every((finding) => finding.severity === 'warning'));
  assert.equal(result.specs[0].acceptance[0].verification, 'not_recorded');
  assert.ok(!files.some((file) => /menus|custom|decisions/.test(file.path)));
  await assert.rejects(renderStarterBundle(' \n '), /one line/);
});

test('setup inspection reports each missing piece of an empty repository', async (t) => {
  const setup = await inspectRepositorySetup(await repository(t));
  assert.equal(setup.config.state, 'missing');
  assert.equal(setup.package.state, 'missing');
  assert.equal(setup.skills.claude.state, 'missing');
  assert.equal(setup.skills.codex.state, 'missing');
  assert.equal(setup.plugin.state, 'missing');
});

test('setup inspection recognizes installed pieces and distinguishes foreign or invalid files', async (t) => {
  const directory = await repository(t);
  await put(directory, SETUP.config, '{"schema_version":2}');
  await put(
    directory,
    'package.json',
    JSON.stringify({ devDependencies: { [SETUP.packageName]: '^0.1.0' } }),
  );
  await put(
    directory,
    SETUP.skills.claude,
    `---\nname: spectrum\n---\n\n<!-- ${SETUP.skillMarker} 0.1.0; reinstall -->\n`,
  );
  await put(directory, SETUP.skills.codex, '# my own skill');
  await put(
    directory,
    SETUP.claudeSettings,
    JSON.stringify({ enabledPlugins: { [SETUP.plugin]: true } }),
  );
  const setup = await inspectRepositorySetup(directory);
  assert.deepEqual(
    [setup.config.state, setup.package.state, setup.package.detail],
    ['ok', 'ok', '^0.1.0'],
  );
  assert.deepEqual([setup.skills.claude.state, setup.skills.claude.detail], ['ok', '0.1.0']);
  assert.equal(setup.skills.codex.state, 'unmanaged');
  assert.equal(setup.plugin.state, 'ok');

  await put(directory, SETUP.config, '{"schema_version":1}');
  await put(directory, 'package.json', '[]');
  const invalid = await inspectRepositorySetup(directory);
  assert.equal(invalid.config.state, 'invalid');
  assert.equal(invalid.package.state, 'invalid');
});

test('setup inspection never follows links out of the repository', async (t) => {
  const directory = await repository(t);
  const outside = await repository(t);
  await put(outside, 'config.json', '{"schema_version":2}');
  await put(outside, '.claude/skills/spectrum/SKILL.md', `<!-- ${SETUP.skillMarker} 9.9.9; -->`);
  await mkdir(join(directory, '.spectrum'));
  await symlink(join(outside, 'config.json'), join(directory, SETUP.config));
  await symlink(join(outside, '.claude'), join(directory, '.claude'));
  const setup = await inspectRepositorySetup(directory);
  assert.equal(setup.config.state, 'missing');
  assert.equal(setup.skills.claude.state, 'missing');
});

test('skill versions come only from the provenance marker', () => {
  assert.equal(skillVersion(`x <!-- ${SETUP.skillMarker} 1.2.3; reinstall -->`), '1.2.3');
  assert.equal(skillVersion('no marker'), null);
});
