import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { checkRepository, parseInventoryCatalog } from './index.ts';

const fiCatalog = {
  schema_version: '1.0',
  tables: {
    FEATURE_CATEGORIES: {
      data: 'feature_categories.tsv',
      extends: 'spectrum:feature_categories',
      columns: [
        { name: 'category_key' },
        { name: 'category_title' },
        { name: 'description', type: 'string', required: false },
      ],
    },
    FEATURES: {
      data: 'features.tsv',
      extends: 'spectrum:features',
      columns: [
        { name: 'feature_id' },
        { name: 'feature_title' },
        { name: 'category_key' },
        { name: 'feature_category' },
      ],
    },
    INTERACTIONS: {
      data: 'interactions.tsv',
      extends: 'spectrum:interactions',
      columns: [
        { name: 'interaction_title' },
        { name: 'interaction_id' },
        { name: 'interaction_type' },
        { name: 'feature' },
        { name: 'category_key' },
        { name: 'feature_id' },
        { name: 'status' },
        { name: 'phase' },
        { name: 'summary' },
        {
          name: 'related_region',
          type: 'string',
          required: false,
          ref: { table: 'REGIONS', column: 'region_key' },
        },
      ],
    },
  },
};
const iaCatalog = {
  schema_version: '1.0',
  tables: {
    REGIONS: {
      kind: 'regions',
      data: 'regions.tsv',
      primary_key: ['region_key'],
      null_values: ['-'],
      columns: [{ name: 'region_key', type: 'string', required: true }],
    },
  },
};

test('a catalog declares several tables, resolves their TSV files and applies base schemas', () => {
  const tables = parseInventoryCatalog(fiCatalog, 'product/feature_inventory/schema.json');
  assert.deepEqual(
    tables.map((table) => [table.kind, table.schema.name, table.data]),
    [
      ['categories', 'FEATURE_CATEGORIES', 'product/feature_inventory/feature_categories.tsv'],
      ['features', 'FEATURES', 'product/feature_inventory/features.tsv'],
      ['interactions', 'INTERACTIONS', 'product/feature_inventory/interactions.tsv'],
    ],
  );
  const features = tables[1].schema;
  assert.equal(features.extends, 'spectrum:features');
  assert.deepEqual(features.primary_key, ['feature_id']);
  assert.deepEqual(features.columns[2].ref, {
    table: 'FEATURE_CATEGORIES',
    column: 'category_key',
  });
  const [regions] = parseInventoryCatalog(iaCatalog, 'ia/schema.json');
  assert.equal(regions.kind, 'regions');
  assert.equal(regions.schema.name, 'REGIONS');
});

test('catalog tables fail with the table name when their definition is invalid', () => {
  const features = fiCatalog.tables.FEATURES;
  const regions = iaCatalog.tables.REGIONS;
  const cases: [unknown, RegExp][] = [
    [{ schema_version: '1.0', tables: {} }, /at least one table/],
    [{ tables: fiCatalog.tables }, /requires schema_version and a tables mapping/],
    [
      { ...fiCatalog, tables: { ITEMS: features } },
      /ITEMS: spectrum:features defines table FEATURES/,
    ],
    [
      { ...fiCatalog, tables: { FEATURES: { ...features, kind: 'routes' } } },
      /FEATURES: .*not routes/,
    ],
    [{ ...fiCatalog, tables: { FEATURES: { ...features, data: '/abs.tsv' } } }, /FEATURES: data/],
    [{ ...fiCatalog, tables: { FEATURES: { ...features, name: 'X' } } }, /FEATURES: the table key/],
    [
      { ...iaCatalog, tables: { REGIONS: { ...regions, kind: undefined } } },
      /REGIONS: kind is required/,
    ],
    [{ ...iaCatalog, tables: { REGIONS: { ...regions, kind: 'rooms' } } }, /REGIONS: unknown kind/],
    [{ ...iaCatalog, tables: { REGIONS: { ...regions, primary_key: ['x'] } } }, /REGIONS: Columns/],
  ];
  for (const [raw, message] of cases)
    assert.throws(() => parseInventoryCatalog(raw, 'schema.json'), message);
});

async function put(root: string, path: string, body: string) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), body);
}
const tsv = (rows: string[][]) => `${rows.map((row) => row.join('\t')).join('\n')}\n`;

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'spectrum-catalog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(root, 'fi/schema.json', JSON.stringify(fiCatalog));
  await put(root, 'ia/schema.json', JSON.stringify(iaCatalog));
  await put(root, 'ia/regions.tsv', tsv([['region_key'], ['cli.root']]));
  await put(
    root,
    'fi/feature_categories.tsv',
    tsv([
      ['category_key', 'category_title', 'description'],
      ['CORE', 'Core', '-'],
    ]),
  );
  await put(
    root,
    'fi/features.tsv',
    tsv([
      ['feature_id', 'feature_title', 'category_key', 'feature_category'],
      ['CORE-001', 'Check', 'CORE', 'Core'],
    ]),
  );
  await put(
    root,
    'fi/interactions.tsv',
    tsv([
      fiCatalog.tables.INTERACTIONS.columns.map((column) => column.name),
      [
        'Check',
        'CORE-001-check',
        'command',
        'Check',
        'CORE',
        'CORE-001',
        'idea',
        '-',
        'Check.',
        'cli.root',
      ],
    ]),
  );
  await put(root, 'rules/agents.md', '# Rules\n');
  await put(
    root,
    'config.json',
    JSON.stringify({
      schema_version: 2,
      name: 'Catalog fixture',
      mode: 'proposal-only',
      canonical_source: 'git-files',
      inventories: [{ catalog: 'fi/schema.json' }, { catalog: 'ia/schema.json' }],
      documents: [{ kind: 'rules', root: 'rules' }],
    }),
  );
  return root;
}

test('repository checks read catalog tables and cross-catalog references', async (t) => {
  const root = await fixture(t);
  const result = await checkRepository(root, { configPath: 'config.json' });
  assert.deepEqual(result.findings, []);
  assert.deepEqual(
    result.model.inventories.map((table) => [table.kind, table.path, table.schemaPath]),
    [
      ['categories', 'fi/feature_categories.tsv', 'fi/schema.json'],
      ['features', 'fi/features.tsv', 'fi/schema.json'],
      ['interactions', 'fi/interactions.tsv', 'fi/schema.json'],
      ['regions', 'ia/regions.tsv', 'ia/schema.json'],
    ],
  );
  assert.ok(
    result.model.relationships.some(
      (r) => r.field === 'related_region' && r.target.startsWith('REGIONS:'),
    ),
  );
});

test('a missing catalog TSV fails only that table; an invalid catalog fails at its path', async (t) => {
  const root = await fixture(t);
  await rm(join(root, 'fi/features.tsv'));
  const missing = await checkRepository(root, { configPath: 'config.json' });
  assert.ok(
    missing.findings.some((f) => f.code === 'missing-file' && f.path === 'fi/features.tsv'),
  );
  assert.ok(missing.model.inventories.some((table) => table.schema.name === 'INTERACTIONS'));

  await put(root, 'ia/schema.json', JSON.stringify({ ...iaCatalog, tables: { REGIONS: {} } }));
  const invalid = await checkRepository(root, { configPath: 'config.json' });
  assert.ok(
    invalid.findings.some(
      (f) =>
        f.code === 'invalid-inventory' &&
        f.path === 'ia/schema.json' &&
        f.message.startsWith('REGIONS: data'),
    ),
  );

  await put(
    root,
    'ia/schema.json',
    JSON.stringify({
      ...iaCatalog,
      tables: { REGIONS: { ...iaCatalog.tables.REGIONS, data: '../../outside.tsv' } },
    }),
  );
  const escaped = await checkRepository(root, { configPath: 'config.json' });
  assert.ok(
    escaped.findings.some((f) => f.code === 'unsafe-path'),
    JSON.stringify(escaped.findings),
  );
});
