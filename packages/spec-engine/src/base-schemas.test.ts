import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { baseInventorySchemas, checkRepository, extendInventorySchema } from './index.ts';

const featureExtension = {
  schema_version: '1.0',
  extends: 'spectrum:features',
  columns: [
    { name: 'feature_id' },
    { name: 'feature_title', description: 'Customer wording.' },
    { name: 'category_key' },
    { name: 'feature_category' },
    {
      name: 'entitlement_key',
      type: 'string',
      required: false,
      enum: ['public_access', 'core_license'],
    },
  ],
};

test('an extension keeps engine-owned identity and base rules while adding columns in header order', () => {
  const schema = extendInventorySchema(featureExtension, 'features');
  assert.equal(schema.name, 'FEATURES');
  assert.equal(schema.extends, 'spectrum:features');
  assert.deepEqual(schema.primary_key, ['feature_id']);
  assert.deepEqual(schema.null_values, ['-']);
  assert.deepEqual(
    schema.columns.map((column) => column.name),
    ['feature_id', 'feature_title', 'category_key', 'feature_category', 'entitlement_key'],
  );
  assert.deepEqual(schema.columns[2].ref, { table: 'FEATURE_CATEGORIES', column: 'category_key' });
  assert.equal(schema.columns[1].required, true);
  assert.equal(schema.columns[1].description, 'Customer wording.');
  assert.deepEqual(schema.columns[4].enum, ['public_access', 'core_license']);
  // Merging never mutates the shared base definitions.
  assert.equal(
    baseInventorySchemas['spectrum:features'].columns.some((c) => 'description' in c),
    false,
  );
});

test('extensions cannot replace base identity, base column rules or omit base columns', () => {
  const columns = featureExtension.columns;
  const cases: [unknown, string, RegExp][] = [
    [{ ...featureExtension, extends: 'spectrum:menus' }, 'features', /Unknown base schema/],
    [featureExtension, 'interactions', /extends the features inventory, not interactions/],
    [{ ...featureExtension, primary_key: ['feature_title'] }, 'features', /primary_key is owned/],
    [{ ...featureExtension, name: 'ITEMS' }, 'features', /name is owned/],
    [
      {
        ...featureExtension,
        columns: [
          ...columns.slice(0, 2),
          { name: 'category_key', type: 'string', required: false },
          ...columns.slice(3),
        ],
      },
      'features',
      /category_key is defined by spectrum:features/,
    ],
    [
      { ...featureExtension, columns: columns.filter((c) => c.name !== 'feature_category') },
      'features',
      /requires base columns: feature_category/,
    ],
    [
      { ...featureExtension, columns: [...columns, { name: 'feature_id' }] },
      'features',
      /Columns and primary keys must be unique/,
    ],
    [{ ...featureExtension, schema_version: undefined }, 'features', /requires schema_version/],
  ];
  for (const [raw, kind, message] of cases)
    assert.throws(() => extendInventorySchema(raw, kind as 'features'), message);
});

async function put(root: string, path: string, body: string) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), body);
}

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'spectrum-base-schema-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tables = {
    categories: {
      extends: 'spectrum:feature_categories',
      columns: [{ name: 'category_key' }, { name: 'category_title' }],
      rows: [['CORE', 'Core']],
    },
    features: { ...featureExtension, rows: [['CORE-001', 'Check', 'CORE', 'Core', '-']] },
    interactions: {
      extends: 'spectrum:interactions',
      columns: [
        ...baseInventorySchemas['spectrum:interactions'].columns.map(({ name }) => ({ name })),
        { name: 'shortcut', type: 'string', required: false },
      ],
      rows: [
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
          '-',
        ],
      ],
    },
  };
  const inventories = [];
  for (const [kind, { rows, ...schema }] of Object.entries(tables)) {
    const dir = `inventory/${kind}`;
    await put(root, `${dir}/schema.json`, JSON.stringify({ schema_version: '1.0', ...schema }));
    await put(
      root,
      `${dir}/data.tsv`,
      `${[schema.columns.map((c) => c.name), ...rows].map((row) => row.join('\t')).join('\n')}\n`,
    );
    inventories.push({ kind, data: `${dir}/data.tsv`, schema: `${dir}/schema.json` });
  }
  await put(root, 'rules/agents.md', '# Rules\n');
  await put(
    root,
    'config.json',
    JSON.stringify({
      schema_version: 2,
      name: 'Base schema fixture',
      mode: 'proposal-only',
      canonical_source: 'git-files',
      inventories,
      documents: [{ kind: 'rules', root: 'rules' }],
    }),
  );
  return root;
}

test('repository checks validate extension tables with base references and required values', async (t) => {
  const root = await fixture(t);
  const valid = await checkRepository(root, { configPath: 'config.json' });
  assert.deepEqual(valid.findings, []);
  assert.equal(
    valid.model.inventories.find((table) => table.kind === 'features')?.schema.extends,
    'spectrum:features',
  );
  assert.ok(
    valid.model.relationships.some(
      (r) => r.field === 'category_key' && r.target.startsWith('FEATURE_CATEGORIES:'),
    ),
  );

  await put(
    root,
    'inventory/features/data.tsv',
    'feature_id\tfeature_title\tcategory_key\tfeature_category\tentitlement_key\nCORE-001\t-\tNOPE\tCore\tgold\n',
  );
  const invalid = await checkRepository(root, { configPath: 'config.json' });
  for (const code of ['required-value', 'invalid-reference', 'invalid-value'])
    assert.ok(
      invalid.findings.some((f) => f.code === code && f.path === 'inventory/features/data.tsv'),
      code,
    );
});

test('an invalid extension reports the schema path and reason', async (t) => {
  const root = await fixture(t);
  await put(
    root,
    'inventory/categories/schema.json',
    JSON.stringify({
      schema_version: '1.0',
      extends: 'spectrum:feature_categories',
      columns: [{ name: 'category_key' }],
    }),
  );
  const result = await checkRepository(root, { configPath: 'config.json' });
  assert.equal(result.ok, false);
  assert.ok(
    result.findings.some(
      (f) =>
        f.code === 'invalid-inventory' &&
        f.path === 'inventory/categories/schema.json' &&
        f.message.includes('requires base columns: category_title'),
    ),
  );
});
