import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { checkRepository } from './index.ts';

const text = (name: string, required = true) => ({ name, type: 'string', required });
const catalog = {
  schema_version: '1.0',
  tables: {
    SURFACES: {
      kind: 'surfaces',
      data: 'surfaces.tsv',
      primary_key: ['surface_key'],
      null_values: ['-'],
      columns: [text('surface_key')],
    },
    SURFACE_STRUCTURE: {
      kind: 'regions',
      data: 'surface_structure.tsv',
      primary_key: ['structure_key'],
      null_values: ['-'],
      columns: [
        { ...text('surface_key'), ref: { table: 'SURFACES', column: 'surface_key' } },
        text('structure_key'),
      ],
    },
    ROUTES: {
      kind: 'routes',
      data: 'routes.tsv',
      primary_key: ['page_id'],
      null_values: ['-'],
      columns: [
        text('page_id'),
        text('path'),
        {
          ...text('region', false),
          ref: { table: 'SURFACE_STRUCTURE', column: 'structure_key' },
        },
        text('type'),
        text('implementation_status'),
      ],
    },
  },
};
const tsv = (rows: string[][]) => `${rows.map((row) => row.join('\t')).join('\n')}\n`;
const contract = (body: string) => `[contract]\nid = "surface.${body.split('"')[1]}"\n${body}\n`;

async function put(root: string, path: string, body: string) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), body);
}

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'spectrum-surface-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(root, 'product/schema.json', JSON.stringify(catalog));
  await put(root, 'product/surfaces.tsv', tsv([['surface_key'], ['web'], ['cli']]));
  await put(
    root,
    'product/surface_structure.tsv',
    tsv([
      ['surface_key', 'structure_key'],
      ['web', 'web.overview'],
      ['web', 'web.search'],
      ['cli', 'cli.output'],
    ]),
  );
  await put(
    root,
    'product/routes.tsv',
    tsv([
      ['page_id', 'path', 'region', 'type', 'implementation_status'],
      ['OVERVIEW', '/', 'web.overview', 'page', 'implemented'],
    ]),
  );
  await put(
    root,
    'product/surfaces/web/overview/contract.toml',
    contract('region = "web.overview"'),
  );
  await put(root, 'product/surfaces/web/overview/layout.md', '# Overview layout\n');
  await put(root, 'product/surfaces/web/overview/flow.md', '# Overview flow\n');
  // A region without a route needs only its contract.
  await put(root, 'product/surfaces/cli/output/contract.toml', contract('region = "cli.output"'));
  await put(root, 'rules/agents.md', '# Rules\n');
  await put(
    root,
    'config.json',
    JSON.stringify({
      schema_version: 2,
      name: 'Surface fixture',
      mode: 'proposal-only',
      canonical_source: 'git-files',
      inventories: [{ catalog: 'product/schema.json' }],
      documents: [
        { kind: 'surface_bundle', root: 'product/surfaces' },
        { kind: 'rules', root: 'rules' },
      ],
    }),
  );
  return root;
}
const check = (root: string) => checkRepository(root, { configPath: 'config.json' });

test('surface contracts bind screen bundles to regions on any surface', async (t) => {
  const result = await check(await fixture(t));
  assert.deepEqual(result.findings, []);
  const kinds = Object.fromEntries(result.model.documents.map((doc) => [doc.path, doc.kind]));
  assert.equal(kinds['product/surfaces/web/overview/contract.toml'], 'surface_contract');
  assert.equal(kinds['product/surfaces/web/overview/layout.md'], 'layout');
  assert.equal(kinds['product/surfaces/web/overview/flow.md'], 'flow');
  assert.equal(kinds['product/surfaces/cli/output/contract.toml'], 'surface_contract');
  assert.deepEqual(
    result.model.relationships
      .filter((r) => r.kind === 'region_contract')
      .map((r) => [r.source, r.target]),
    [
      ['cli.output', 'product/surfaces/cli/output/contract.toml'],
      ['web.overview', 'product/surfaces/web/overview/contract.toml'],
    ],
  );
});

test('a routed region needs a surface contract with layout and flow', async (t) => {
  const root = await fixture(t);
  await rm(join(root, 'product/surfaces/web/overview/flow.md'));
  const missingFlow = await check(root);
  assert.deepEqual(
    missingFlow.findings.map((f) => [f.code, f.path]),
    [['missing-page-document', 'product/surfaces/web/overview/contract.toml']],
  );

  await rm(join(root, 'product/surfaces/web/overview'), { recursive: true });
  const missingBundle = await check(root);
  assert.deepEqual(
    missingBundle.findings.map((f) => [f.code, f.path, f.message]),
    [
      [
        'missing-page-contract',
        'product/routes.tsv',
        'OVERVIEW needs a surface contract for region web.overview.',
      ],
    ],
  );
});

test('surface contracts declare a known region once and leave route facts to ROUTES', async (t) => {
  const root = await fixture(t);
  const bundle = 'product/surfaces/web';
  await put(root, `${bundle}/unknown/contract.toml`, contract('region = "web.missing"'));
  await put(root, `${bundle}/none/contract.toml`, '[contract]\nid = "surface.none"\n');
  await put(
    root,
    `${bundle}/search/contract.toml`,
    contract('region = "web.search"\npath = "/search"\npage_id = "SEARCH"'),
  );
  await put(
    root,
    `${bundle}/again/contract.toml`,
    '[contract]\nid = "again"\nregion = "cli.output"\n',
  );
  const result = await check(root);
  assert.deepEqual(
    result.findings.map((f) => [f.code, f.path, f.message]),
    [
      [
        'duplicate-id',
        `${bundle}/again/contract.toml`,
        'Duplicate surface contract for cli.output.',
      ],
      [
        'invalid-contract',
        `${bundle}/none/contract.toml`,
        'A surface contract requires [contract].region.',
      ],
      [
        'invalid-contract',
        `${bundle}/search/contract.toml`,
        'A surface contract binds by region; page_id, path belong to ROUTES.',
      ],
      ['invalid-reference', `${bundle}/unknown/contract.toml`, 'Unknown region web.missing.'],
    ],
  );
});

test('routes without a region keep the brownfield page_id binding', async (t) => {
  const root = await fixture(t);
  await put(
    root,
    'product/routes.tsv',
    tsv([
      ['page_id', 'path', 'region', 'type', 'implementation_status'],
      ['OVERVIEW', '/', '-', 'page', 'implemented'],
    ]),
  );
  const result = await check(root);
  assert.deepEqual(
    result.findings.map((f) => [f.code, f.message]),
    [['missing-page-contract', 'OVERVIEW needs a page contract bundle.']],
  );
});
