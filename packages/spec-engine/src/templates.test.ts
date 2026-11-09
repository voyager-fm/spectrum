import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { parse as parseToml } from 'smol-toml';
import { checkRepository } from './index.ts';
import { parseMarkdown } from './markdown.ts';
import { listTemplates, loadTemplate, renderTemplate, type TemplateValues } from './templates.ts';

const values: Record<string, string> = {
  project_name: 'Example',
  product_intent: 'Read records.',
  product_scope: 'Local inspection.',
  category_key: 'READ',
  category_title: 'Reading',
  feature_id: 'READ-001',
  feature_title: 'Read records',
  interaction_id: 'READ-001-read_record',
  interaction_title: 'Read record',
  summary: 'Read a local record.',
  object_key: 'record',
  object_label: 'Record',
  object_definition: 'A local record.',
  surface_key: 'cli',
  structure_key: 'cli.root',
  region_id: 'root',
  region_label: 'Command output',
  contract_id: 'reading.record',
  initial_state: 'idle',
  result_state: 'ready',
  read_state: 'record',
  write_state: 'result',
  page_id: 'HOME',
  page_title: 'Home',
  route_path: '/',
  surface_contract_id: 'surface.cli.root',
  page_responsibility: 'Explain the product.',
  page_policy: 'Show planned capabilities explicitly.',
  platform: 'common',
  article_key: 'record_reading',
  article_title: 'Record reading',
  decision_date: '2026-11-09',
  decision_month: '2026-11',
  menu_node_id: 'main',
  menu_label: 'Main',
  table_key: 'records',
  table_name: 'RECORDS',
  record_key: 'first',
};

async function completedValues(): Promise<TemplateValues> {
  const result = { ...values };
  for (const template of await listTemplates()) {
    const loaded = await loadTemplate(template.id);
    for (const match of `${loaded.output}\n${loaded.content}`.matchAll(
      /\{\{(?:text|json|tsv|path):([a-z_]+)\}\}/g,
    ))
      result[match[1]] ??= 'TBD';
  }
  return result;
}

test('templates render a connected repository that passes the real engine', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'spectrum-templates-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const inputs = await completedValues();
  for (const template of await listTemplates()) {
    const output = await renderTemplate(template.id, inputs);
    await mkdir(dirname(join(directory, output.path)), { recursive: true });
    await writeFile(join(directory, output.path), output.content);
    if (output.path.endsWith('.toml')) assert.doesNotThrow(() => parseToml(output.content));
    if (output.path.endsWith('.md')) assert.doesNotThrow(() => parseMarkdown(output.content));
  }
  const result = await checkRepository(directory);
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.equal(result.specs[0].id, inputs.interaction_id);
  assert.equal(result.specs[0].status, 'draft');
  assert.equal(result.specs[0].acceptance[0].verification, 'not_recorded');
  const routeTable = result.model.inventories.find((table) => table.kind === 'routes');
  assert.equal(routeTable?.path, '.spectrum/product/feature_inventory/routes.tsv');
  assert.ok(
    result.model.relationships.some(
      (rel) =>
        rel.kind === 'region_contract' &&
        rel.source === 'cli.root' &&
        rel.target === '.spectrum/product/feature_inventory/surfaces/cli/root/contract.toml',
    ),
  );
  for (const kind of [
    'interaction',
    'contract',
    'flow',
    'surface_contract',
    'layout',
    'surface_spec',
    'engineering',
  ])
    assert.ok(
      result.model.documents.some((doc) => doc.kind === kind),
      kind,
    );
});

test('template substitutions escape structured values and reject unsafe output paths and TSV cells', async () => {
  const inputs = await completedValues();
  const title = 'A "quoted" title\nwith a second line';
  const config = await renderTemplate('repository.config', { ...inputs, project_name: title });
  assert.equal(JSON.parse(config.content).name, title);
  const contract = await renderTemplate('feature.contract', { ...inputs, policy: title });
  assert.equal(
    parseToml(contract.content).policy &&
      (parseToml(contract.content).policy as Record<string, unknown>).behavior,
    title,
  );
  await assert.rejects(
    renderTemplate('feature.interaction', { ...inputs, category_key: '../escape' }),
    /Unsafe template path/,
  );
  await assert.rejects(
    renderTemplate('inventory.features.data', { ...inputs, feature_title: 'two\tcells' }),
    /one cell/,
  );
  const custom = await renderTemplate('inventory.custom.catalog', { ...inputs, table_name: title });
  assert.deepEqual(Object.keys(JSON.parse(custom.content).tables), [title]);
  await assert.rejects(renderTemplate('feature.interaction', {}), /Missing template value/);
  await assert.rejects(loadTemplate('../outside'), /Unknown specification template/);
});

test('templates reference engine schemas by URL and install no schema copies', async () => {
  const base =
    'https://raw.githubusercontent.com/voyager-fm/spectrum/main/packages/spec-engine/schemas/';
  const inputs = await completedValues();
  for (const template of await listTemplates()) {
    const output = await renderTemplate(template.id, inputs);
    assert.ok(!output.path.startsWith('.spectrum/schemas/'), output.path);
    assert.ok(!template.source.startsWith('schemas/'), template.source);
    if (!output.path.endsWith('.json')) continue;
    const schema: unknown = JSON.parse(output.content).$schema;
    if (schema === undefined) continue;
    assert.ok(typeof schema === 'string' && schema.startsWith(base), `${template.id}: ${schema}`);
    await access(resolve(import.meta.dirname, '../schemas', schema.slice(base.length)));
  }
});
