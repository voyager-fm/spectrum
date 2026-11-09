import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { checkRepository } from './index.ts';

test('self inventories and interaction specifications validate', async () => {
  const r = await checkRepository(resolve(import.meta.dirname, '../../..'));
  assert.deepEqual(r.findings, []);
  assert.equal(r.ok, true);
  const featureIds = new Set(r.specs.map((s) => s.featureId));
  for (const id of [
    'VAL-001',
    'DSH-001',
    'LOOP-001',
    'AGT-001',
    'VAL-002',
    'DSH-002',
    'DSH-003',
    'AGT-002',
    'TRC-001',
  ])
    assert.ok(featureIds.has(id), `Missing canonical feature ${id}`);
  const features = r.model.inventories.find((table) => table.kind === 'features');
  assert.ok(features);
  for (const row of features.rows) {
    assert.match(row.values.feature_id, new RegExp(`^${row.values.category_key}-[0-9]{3}$`));
  }
  const categories = r.model.inventories.find((table) => table.kind === 'categories');
  assert.deepEqual(
    categories?.rows.map((row) => row.values.category_key),
    ['VAL', 'DSH', 'AGT', 'LOOP', 'INT', 'SET', 'TRC'],
  );
  for (const suffix of [
    'resolve_implementation_links',
    'inspect_linked_implementation',
    'open_implementation_source',
  ]) {
    const spec = r.specs.find((item) => item.id === `TRC-001-${suffix}`);
    assert.ok(spec);
    assert.equal(spec.implementationStatus, 'planned');
    assert.equal(spec.phase, 'next');
  }
  assert.ok(r.model.inventories.some((table) => table.kind === 'objects'));
  assert.ok(r.model.documents.some((doc) => doc.kind === 'engineering'));
});
test('retired integration and agent flags warn without changing the parsed configuration', async () => {
  const root = resolve(import.meta.dirname, '../../..');
  const current = JSON.parse(await readFile(join(root, '.spectrum/config.json'), 'utf8'));
  const r = await checkRepository(root, {
    config: {
      ...current,
      integrations: { github: { enabled: true }, linear: { enabled: true } },
      agents: { enabled: true, max_repair_attempts: 2 },
    },
  });
  assert.equal(r.ok, true);
  assert.deepEqual(
    r.findings.map((f) => [f.code, f.severity, f.message.split(' ')[0]]),
    [
      ['retired-config-key', 'warning', 'integrations'],
      ['retired-config-key', 'warning', 'agents'],
    ],
  );
  assert.ok(r.config);
  assert.equal('integrations' in r.config, false);
  assert.equal('agents' in r.config, false);
});
test('legacy feature-only configuration reports an explicit migration boundary', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spectrum-test-'));
  try {
    await mkdir(join(dir, '.spectrum/features'), { recursive: true });
    await writeFile(
      join(dir, '.spectrum/config.json'),
      JSON.stringify({ schemaVersion: 1, specRoot: 'features' }),
    );
    for (const name of ['a', 'b'])
      await writeFile(
        join(dir, `.spectrum/features/${name}.json`),
        JSON.stringify({
          id: 'VAL-001',
          title: 'Test',
          status: 'draft',
          acceptance: ['Works'],
          links: ['missing.md', '../../outside'],
        }),
      );
    const r = await checkRepository(dir);
    assert.equal(r.ok, false);
    assert.ok(
      r.findings.some((f) => f.code === 'invalid-config' && /schema_version/.test(f.message)),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
