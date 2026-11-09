import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadTemplate } from '@spectrum/spec-engine/templates';
import { bundleCli } from './bundle.ts';

for (const standalone of [false, true])
  test(`new describes, previews and creates drafts (${standalone ? 'standalone' : 'source'})`, async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'spectrum-new-process-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const binary = standalone ? join(root, 'spectrum.mjs') : join(import.meta.dirname, 'index.ts');
    if (standalone) await writeFile(binary, await bundleCli('new-process.test.ts'));
    const before = await readdir(root);
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [binary, 'new', ...args], {
        cwd: root,
        encoding: 'utf8',
      });
    const description = run('adr', '--describe');
    assert.equal(description.status, 0, description.stderr);
    assert.ok(JSON.parse(description.stdout).requiredValues.length > 0);
    assert.deepEqual(await readdir(root), before);
    const template = await loadTemplate('engineering.adr');
    const values: Record<string, string> = {};
    for (const match of `${template.output}\n${template.content}`.matchAll(
      /\{\{(?:text|json|tsv|path):([a-z_]+)\}\}/g,
    ))
      values[match[1]] = 'example';
    const valuesPath = join(root, 'values.json');
    await writeFile(valuesPath, JSON.stringify(values));
    const args = ['adr', '--values', valuesPath, '--out', 'drafts/decision.md'];
    const preview = run(...args, '--dry-run');
    assert.equal(preview.status, 0, preview.stderr);
    assert.deepEqual(await readdir(root), [...before, 'values.json'].sort());
    const created = run(...args);
    assert.equal(created.status, 0, created.stderr);
    const result = JSON.parse(created.stdout);
    assert.equal(result.check, null);
    assert.equal(
      await readFile(join(root, result.created[0]), 'utf8'),
      JSON.parse(preview.stdout).files[0].content,
    );
    assert.equal(run(...args).status, 1);
    assert.equal(run('adr').status, 1);
    assert.equal(run('adr', '--force').status, 1);
  });
