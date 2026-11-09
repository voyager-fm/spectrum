import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { loadDashboard } from './dashboard.ts';

const repoRoot = resolve(import.meta.dirname, '../../../..');

test('dashboard snapshot reads the repository own specs, rules and config', async () => {
  const data = await loadDashboard(repoRoot);
  assert.deepEqual(data.errors, []);
  assert.equal(data.check?.ok, true);
  assert.ok(data.check?.specs.some((s) => s.id === 'SP-001-check_repository'));
  assert.ok(data.contracts.some((d) => d.path.endsWith('/contracts/validation.toml')));
  assert.ok(data.flows.some((d) => d.path.endsWith('/flows/validation.md')));
  assert.ok(data.documents.some((d) => d.path.endsWith('/page_contracts/specs/contract.toml')));
  assert.ok(
    data.rules.some((r) => r.path === '.spectrum/rules/agents.md' && r.title === 'Agent rules'),
  );
  assert.equal(data.overview?.title, 'Spectrum');
  assert.equal(data.config?.mode, 'proposal-only');
  assert.equal(data.config?.github, false);
  assert.equal(data.config?.canonicalSource, 'git-files');
});

test('missing spectrum data is reported as errors, not replaced with samples', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spectrum-web-'));
  try {
    const data = await loadDashboard(dir);
    assert.equal(data.check, null);
    assert.equal(data.config, null);
    assert.deepEqual(data.rules, []);
    assert.equal(data.overview, null);
    assert.ok(data.errors.some((e) => e.startsWith('config:')));
    assert.ok(data.errors.some((e) => e.startsWith('spec check:')));
    assert.equal(data.repository.revision, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('dashboard reads configured document paths through the shared engine', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spectrum-web-'));
  try {
    await cp(join(repoRoot, '.spectrum'), join(dir, '.spectrum'), { recursive: true });
    await mkdir(join(dir, 'existing/rules'), { recursive: true });
    await writeFile(join(dir, 'existing/rules/b.md'), 'intro\n# Beta rules\n');
    await writeFile(join(dir, 'existing/rules/a.toml'), 'key = 1\n');
    await writeFile(join(dir, 'existing/rules/ignored.json'), '{}');
    const configPath = join(dir, '.spectrum/config.json');
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    config.documents.find((source: { kind: string }) => source.kind === 'rules').root =
      'existing/rules';
    await writeFile(configPath, JSON.stringify(config));
    const data = await loadDashboard(dir);
    assert.equal(data.check?.ok, true);
    assert.deepEqual(
      data.rules.map((d) => [d.path, d.title]),
      [
        ['existing/rules/a.toml', 'a.toml'],
        ['existing/rules/b.md', 'Beta rules'],
      ],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a missing configured source remains a load failure rather than an empty success', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'spectrum-web-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(join(repoRoot, '.spectrum'), join(dir, '.spectrum'), { recursive: true });
  await rm(join(dir, '.spectrum/rules'), { recursive: true });
  const data = await loadDashboard(dir);
  assert.equal(data.check?.ok, false);
  assert.deepEqual(data.rules, []);
  assert.ok(data.errors.some((error) => error.startsWith('.spectrum/rules:')));
});
