import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { loadDashboard, readDocuments } from './dashboard.ts';

const repoRoot = resolve(import.meta.dirname, '../../../..');

test('dashboard snapshot reads the repository own specs, rules and config', async () => {
  const data = await loadDashboard(repoRoot);
  assert.deepEqual(data.errors, []);
  assert.equal(data.check?.ok, true);
  assert.ok(data.check?.specs.some((s) => s.id === 'SP-001'));
  assert.ok(
    data.rules.some((r) => r.path === '.spectrum/rules/agents.md' && r.title === 'Agent rules'),
  );
  assert.equal(data.overview?.title, 'Spectrum');
  assert.equal(data.config?.mode, 'proposal-only');
  assert.equal(data.config?.github, false);
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

test('documents are sorted, filtered to md/toml and titled by first heading', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spectrum-web-'));
  try {
    await mkdir(join(dir, '.spectrum/rules'), { recursive: true });
    await writeFile(join(dir, '.spectrum/rules/b.md'), 'intro\n# Beta rules\n');
    await writeFile(join(dir, '.spectrum/rules/a.toml'), 'key = 1\n');
    await writeFile(join(dir, '.spectrum/rules/ignored.json'), '{}');
    const docs = await readDocuments(dir, 'rules');
    assert.deepEqual(
      docs.map((d) => [d.path, d.title]),
      [
        ['.spectrum/rules/a.toml', 'a.toml'],
        ['.spectrum/rules/b.md', 'Beta rules'],
      ],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
