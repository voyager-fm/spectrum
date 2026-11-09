import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  region_label: 'Command output',
  contract_id: 'reading.record',
  initial_state: 'idle',
  result_state: 'ready',
  read_state: 'record',
  write_state: 'result',
  page_id: 'HOME',
  page_key: 'home',
  page_title: 'Home',
  route_path: '/',
  page_contract_id: 'website.home',
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
  assert.equal(routeTable?.path, '.spectrum/product/website/route_map/routes/data.tsv');
  assert.ok(
    result.model.documents.some(
      (doc) =>
        doc.kind === 'page_contract' &&
        doc.path === '.spectrum/product/website/page_contracts/home/contract.toml',
    ),
  );
  for (const template of await listTemplates()) {
    const output = await renderTemplate(template.id, inputs);
    if (!output.path.endsWith('.json')) continue;
    const schema = JSON.parse(output.content).$schema;
    if (typeof schema === 'string' && !schema.includes(':')) {
      const installed = await readFile(resolve(directory, dirname(output.path), schema), 'utf8');
      assert.doesNotThrow(() => JSON.parse(installed));
    }
  }
  for (const kind of [
    'interaction',
    'contract',
    'flow',
    'page_contract',
    'layout',
    'page_spec',
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
  await assert.rejects(renderTemplate('feature.interaction', {}), /Missing template value/);
  await assert.rejects(loadTemplate('../outside'), /Unknown specification template/);
});

test('shipped schema and layout definitions match the self-repository installation', async () => {
  for (const template of (await listTemplates()).filter((template) =>
    template.id.startsWith('schema.'),
  )) {
    const output = await renderTemplate(template.id, {});
    const installed = await readFile(resolve(import.meta.dirname, '../../..', output.path), 'utf8');
    assert.deepEqual(JSON.parse(output.content), JSON.parse(installed));
  }
  const layout = await renderTemplate('repository.structure', {});
  assert.equal(
    layout.content,
    await readFile(resolve(import.meta.dirname, '../../..', layout.path), 'utf8'),
  );
});
