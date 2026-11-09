import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { checkRepository } from './index.ts';

const interaction = 'CORE-001-check_repository';
const specPath = '.spectrum/product/feature_specs/core/check_repository.md';
const sections = [
  'Intent',
  'Trigger / Entry Points',
  'Preconditions',
  'Expected Outcome',
  'State Changes',
  'User-visible Feedback',
  'Edge Cases / Failure Handling',
  'Acceptance Criteria',
  'Permissions / Dependencies',
  'Observability / Analytics',
  'Related Interactions',
  'Source',
];

async function put(root: string, path: string, body: string) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), body);
}

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'spectrum-model-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tables = [
    {
      kind: 'categories',
      name: 'FEATURE_CATEGORIES',
      primary_key: ['category_key'],
      columns: [
        { name: 'category_key', type: 'string', required: true },
        { name: 'category_title', type: 'string', required: true },
      ],
      rows: [['CORE', 'Core']],
    },
    {
      kind: 'features',
      name: 'FEATURES',
      primary_key: ['feature_id'],
      columns: [
        { name: 'feature_id', type: 'string', required: true },
        {
          name: 'category_key',
          type: 'string',
          required: true,
          ref: { table: 'FEATURE_CATEGORIES', column: 'category_key' },
        },
        { name: 'feature_title', type: 'string', required: true },
        {
          name: 'feature_category',
          type: 'string',
          required: true,
          ref: { table: 'FEATURE_CATEGORIES', column: 'category_title' },
        },
      ],
      rows: [['CORE-001', 'CORE', 'Check repository', 'Core']],
    },
    {
      kind: 'interactions',
      name: 'INTERACTIONS',
      primary_key: ['interaction_id'],
      columns: [
        { name: 'interaction_id', type: 'string', required: true },
        { name: 'interaction_title', type: 'string', required: true },
        {
          name: 'interaction_type',
          type: 'string',
          required: true,
          enum: ['command', 'input', 'display', 'background'],
        },
        {
          name: 'feature_id',
          type: 'string',
          required: true,
          ref: { table: 'FEATURES', column: 'feature_id' },
        },
        {
          name: 'feature',
          type: 'string',
          required: true,
          ref: { table: 'FEATURES', column: 'feature_title' },
        },
        {
          name: 'category_key',
          type: 'string',
          required: true,
          ref: { table: 'FEATURE_CATEGORIES', column: 'category_key' },
        },
        {
          name: 'status',
          type: 'string',
          required: true,
          enum: ['idea', 'drafted', 'planned', 'implementing', 'shipped', 'deprecated'],
        },
        { name: 'phase', type: 'string', required: false, enum: ['-', 'now', 'next', 'later'] },
        { name: 'summary', type: 'string', required: true },
        {
          name: 'related_region',
          type: 'string',
          required: false,
          ref: { table: 'WINDOW_STRUCTURE', column: 'structure_key' },
        },
        { name: 'menu', type: 'string', required: false },
        { name: 'shortcut', type: 'string', required: false },
      ],
      rows: [
        [
          interaction,
          'Check repository',
          'command',
          'CORE-001',
          'Check repository',
          'CORE',
          'implementing',
          'now',
          'Validate canonical documents.',
          'cli.root',
          '-',
          '-',
        ],
      ],
    },
    {
      kind: 'regions',
      name: 'WINDOW_STRUCTURE',
      primary_key: ['structure_key'],
      columns: [
        { name: 'window_id', type: 'string', required: true },
        { name: 'region_id', type: 'string', required: true },
        {
          name: 'parent_region_id',
          type: 'string',
          required: false,
          ref: {
            table: 'WINDOW_STRUCTURE',
            columns: ['window_id', 'parent_region_id'],
            references: ['window_id', 'region_id'],
          },
        },
        { name: 'structure_key', type: 'string', required: true },
        {
          name: 'interaction_refs',
          type: 'string',
          required: false,
          ref: { table: 'INTERACTIONS', column: 'interaction_id' },
        },
      ],
      rows: [['cli', 'root', '-', 'cli.root', interaction]],
    },
    {
      kind: 'routes',
      name: 'ROUTES',
      primary_key: ['page_id'],
      columns: [
        { name: 'page_id', type: 'string', required: true },
        { name: 'page_name', type: 'string', required: true },
        { name: 'path', type: 'string', required: true },
        {
          name: 'implementation_status',
          type: 'string',
          required: true,
          enum: ['implemented', 'planned'],
        },
      ],
      rows: [['HOME', 'Home', '/', 'planned']],
    },
  ];
  const inventories = [];
  for (const table of tables) {
    const dir = `.spectrum/inventory/${table.name.toLowerCase()}`;
    const { rows, kind, ...schema } = table;
    await put(
      root,
      `${dir}/schema.json`,
      JSON.stringify({ schema_version: '1.0', null_values: ['-'], ...schema }),
    );
    await put(
      root,
      `${dir}/data.tsv`,
      `${[schema.columns.map((c) => c.name), ...rows].map((row) => row.join('\t')).join('\n')}\n`,
    );
    inventories.push({ kind, data: `${dir}/data.tsv`, schema: `${dir}/schema.json` });
  }
  await put(
    root,
    '.spectrum/config.json',
    JSON.stringify({
      schema_version: 2,
      name: 'Fixture',
      mode: 'proposal-only',
      canonical_source: 'git-files',
      inventories,
      documents: [
        { kind: 'feature_bundle', root: '.spectrum/product/feature_specs' },
        { kind: 'page_bundle', root: '.spectrum/product/website/page_contracts' },
      ],
    }),
  );
  const metadata = {
    interaction_id: interaction,
    interaction_type: 'command',
    feature: 'Check repository',
    feature_id: 'CORE-001',
    category_key: 'CORE',
    status: 'implementing',
    phase: 'now',
    summary: 'Validate canonical documents.',
    related_region: 'cli.root',
    menu: '-',
    shortcut: '-',
    document_status: 'draft',
  };
  await put(
    root,
    specPath,
    '---\n' +
      Object.entries(metadata)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join('\n') +
      '\n---\n\n# Check repository\n\n' +
      sections
        .map(
          (section) =>
            `## ${section}\n\n${
              section === 'Acceptance Criteria'
                ? '- [x] **AC-1:** Reject invalid references.\n- [ ] **AC-3:** Preserve IDs.'
                : section === 'Source'
                  ? '- [Contract](contracts/check.toml)\n- [Flow](flows/check.md)'
                  : '-'
            }\n`,
        )
        .join('\n'),
  );
  await put(
    root,
    '.spectrum/product/feature_specs/core/contracts/check.toml',
    `[contract]\nid = "core.check"\ncategory = "CORE"\n\n[policy]\nread_only = true\n\n[ownership."${interaction}"]\nreads = ["repository"]\nwrites = []\n`,
  );
  await put(
    root,
    '.spectrum/product/feature_specs/core/flows/check.md',
    '# Check flow\n\n## Interaction Coverage\n\n- [[.spectrum/product/feature_specs/core/check_repository|Check]]\n\n## Happy Path\n\nRead and validate.\n\n## Failure Handling\n\nReport findings.\n',
  );
  await put(
    root,
    '.spectrum/product/website/page_contracts/home/contract.toml',
    '[contract]\nid = "website.home"\npage_id = "HOME"\npath = "/"\nimplementation_status = "planned"\n\n[responsibility]\nprimary = "Read specifications."\n',
  );
  await put(
    root,
    '.spectrum/product/website/page_contracts/home/layout.md',
    '# Home layout\n\n- Header\n',
  );
  await put(
    root,
    '.spectrum/product/website/page_contracts/home/flow.md',
    '# Home flow\n\nRead specifications.\n',
  );
  return root;
}

async function replace(root: string, path: string, before: string, after: string) {
  const body = await readFile(join(root, path), 'utf8');
  assert.ok(body.includes(before), `Fixture contains ${before}`);
  await put(root, path, body.replace(before, after));
}

test('Brownfield TSV, TOML, Markdown and page bundles preserve IDs and evidence boundaries', async (t) => {
  const result = await checkRepository(await fixture(t));
  assert.deepEqual(result.findings, []);
  assert.equal(result.ok, true);
  assert.equal(result.specs[0].id, interaction);
  assert.equal(result.specs[0].implementationStatus, 'implementing');
  assert.equal(result.specs[0].status, 'draft');
  assert.deepEqual(
    result.specs[0].acceptance.map((ac) => ac.id),
    ['AC-1', 'AC-3'],
  );
  assert.equal(result.specs[0].acceptance[0].verification, 'not_recorded');
  assert.ok(
    result.model.relationships.some((r) => r.kind === 'reference' && r.target.includes('FEATURES')),
  );
  assert.ok(result.model.documents.some((d) => d.kind === 'page_contract'));
  assert.ok(result.model.documents.some((d) => d.kind === 'layout'));
});

test('duplicate primary keys and dangling references fail', async (t) => {
  const root = await fixture(t);
  const path = '.spectrum/inventory/features/data.tsv';
  const body = await readFile(join(root, path), 'utf8');
  await put(root, path, `${body}${body.split('\n')[1]}\n`);
  await replace(root, '.spectrum/inventory/interactions/data.tsv', '\tCORE-001\t', '\tCORE-999\t');
  const result = await checkRepository(root);
  for (const code of ['duplicate-id', 'invalid-reference'])
    assert.ok(
      result.findings.some((f) => f.code === code),
      code,
    );
  assert.equal(result.ok, false);
});

test('TSV row width, required values and enum constraints are checked', async (t) => {
  const root = await fixture(t);
  await replace(
    root,
    '.spectrum/inventory/interactions/data.tsv',
    '\timplementing\t',
    '\tcomplete\t',
  );
  await replace(root, '.spectrum/inventory/features/data.tsv', '\tCheck repository\t', '\t-\t');
  await put(
    root,
    '.spectrum/inventory/feature_categories/data.tsv',
    'category_key\tcategory_title\nCORE\tCore\textra\n',
  );
  const result = await checkRepository(root);
  for (const code of ['invalid-value', 'required-value', 'invalid-tsv'])
    assert.ok(
      result.findings.some((f) => f.code === code),
      code,
    );
});

test('composite and pipe-separated references are checked', async (t) => {
  const root = await fixture(t);
  await replace(
    root,
    '.spectrum/inventory/window_structure/data.tsv',
    `cli\troot\t-\tcli.root\t${interaction}`,
    `cli\troot\tmissing\tcli.root\t${interaction}|CORE-999-missing`,
  );
  assert.equal(
    (await checkRepository(root)).findings.filter((f) => f.code === 'invalid-reference').length,
    2,
  );
});

test('TBD remains a visible unresolved warning and cannot be a primary key', async (t) => {
  const root = await fixture(t);
  await replace(root, '.spectrum/inventory/interactions/data.tsv', '\timplementing\t', '\tTBD\t');
  await replace(root, specPath, 'status: "implementing"', 'status: "TBD"');
  const result = await checkRepository(root);
  assert.ok(result.findings.some((f) => f.code === 'undecided-value' && f.severity === 'warning'));
  assert.equal(result.ok, true);
  await replace(root, '.spectrum/inventory/feature_categories/data.tsv', 'CORE\tCore', 'TBD\tCore');
  assert.ok((await checkRepository(root)).findings.some((f) => f.code === 'invalid-primary-key'));
});

test('FI owns mirrored metadata and feature/category relationships', async (t) => {
  const root = await fixture(t);
  await replace(
    root,
    specPath,
    'summary: "Validate canonical documents."',
    'summary: "Different summary."',
  );
  await replace(
    root,
    '.spectrum/inventory/interactions/data.tsv',
    '\tCheck repository\tCORE\timplementing',
    '\tWrong feature\tCORE\timplementing',
  );
  const result = await checkRepository(root);
  assert.ok(result.findings.some((f) => f.code === 'metadata-mismatch'));
  assert.ok(result.findings.some((f) => f.code === 'feature-mismatch'));
});

test('missing and orphan interaction specs fail', async (t) => {
  const root = await fixture(t);
  await replace(
    root,
    specPath,
    `interaction_id: "${interaction}"`,
    'interaction_id: "CORE-999-orphan"',
  );
  const result = await checkRepository(root);
  for (const code of ['missing-spec', 'orphan-spec'])
    assert.ok(
      result.findings.some((f) => f.code === code),
      code,
    );
});

test('AC IDs are unique and checked boxes never become execution evidence', async (t) => {
  const root = await fixture(t);
  await replace(root, specPath, '**AC-3:**', '**AC-1:**');
  const result = await checkRepository(root);
  assert.ok(result.findings.some((f) => f.code === 'duplicate-ac'));
  assert.ok(result.specs[0].acceptance.every((ac) => ac.verification === 'not_recorded'));
});

test('legacy acceptance statements remain readable while missing IDs are reported', async (t) => {
  const root = await fixture(t);
  await replace(
    root,
    specPath,
    '**AC-1:** Reject invalid references.',
    'Reject invalid references.',
  );
  const result = await checkRepository(root);
  assert.equal(result.specs[0].acceptance.length, 2);
  assert.deepEqual(result.specs[0].acceptance[0], {
    id: null,
    statement: 'Reject invalid references.',
    checked: true,
    verification: 'not_recorded',
  });
  assert.ok(result.findings.some((f) => f.code === 'invalid-ac'));
  assert.equal(result.ok, false);
});

test('code examples cannot satisfy headings, criteria or local links', async (t) => {
  const root = await fixture(t);
  await replace(root, specPath, '## Intent\n\n-', '```md\n## Intent\n[example](missing.md)\n```');
  await replace(
    root,
    specPath,
    '- [x] **AC-1:** Reject invalid references.\n- [ ] **AC-3:** Preserve IDs.',
    '```md\n- [ ] **AC-1:** Example only.\n```',
  );
  const result = await checkRepository(root);
  assert.ok(result.findings.some((f) => f.code === 'missing-section'));
  assert.ok(result.findings.some((f) => f.code === 'missing-acceptance'));
  assert.ok(!result.findings.some((f) => f.code === 'broken-link'));
});

test('malformed TOML and mismatched page contract routes fail', async (t) => {
  const root = await fixture(t);
  await put(root, '.spectrum/product/feature_specs/core/contracts/check.toml', '[contract\n');
  await replace(
    root,
    '.spectrum/product/website/page_contracts/home/contract.toml',
    'path = "/"',
    'path = "/other"',
  );
  const result = await checkRepository(root);
  for (const code of ['invalid-contract', 'route-mismatch'])
    assert.ok(
      result.findings.some((f) => f.code === code),
      code,
    );
});

test('unknown ownership IDs, uncovered flows and broken document links fail', async (t) => {
  const root = await fixture(t);
  await replace(
    root,
    '.spectrum/product/feature_specs/core/contracts/check.toml',
    `[ownership."${interaction}"]`,
    '[ownership."CORE-999-orphan"]',
  );
  await replace(
    root,
    '.spectrum/product/feature_specs/core/flows/check.md',
    '[[.spectrum/product/feature_specs/core/check_repository|Check]]',
    '[Missing](missing.md)',
  );
  const result = await checkRepository(root);
  for (const code of ['invalid-ownership', 'missing-flow-coverage', 'broken-link'])
    assert.ok(
      result.findings.some((f) => f.code === code),
      code,
    );
});

test('traversal and symlink escapes fail before reading target content', async (t) => {
  const root = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), 'spectrum-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await put(outside, 'private.md', '# Private content');
  await symlink(
    join(outside, 'private.md'),
    join(root, '.spectrum/product/feature_specs/core/escape.md'),
  );
  await replace(
    root,
    specPath,
    '- [Contract]',
    '- [Escape](../../../../../outside.md)\n- [Symlink](escape.md)\n- [Contract]',
  );
  const result = await checkRepository(root);
  assert.ok(result.findings.filter((f) => f.code === 'unsafe-path').length >= 2);
  assert.ok(!JSON.stringify(result).includes('Private content'));
});

test('a profile reads canonical documents at existing repository paths', async (t) => {
  const root = await fixture(t);
  await cp(join(root, '.spectrum/product'), join(root, 'PRODUCT'), { recursive: true });
  await replace(
    root,
    'PRODUCT/feature_specs/core/flows/check.md',
    '.spectrum/product/feature_specs/core/check_repository',
    'PRODUCT/feature_specs/core/check_repository',
  );
  const config = JSON.parse(await readFile(join(root, '.spectrum/config.json'), 'utf8'));
  config.documents[0].root = 'PRODUCT/feature_specs';
  await cp(join(root, '.spectrum/product/website/page_contracts'), join(root, 'WEBSITE/pages'), {
    recursive: true,
  });
  config.documents[1].root = 'WEBSITE/pages';
  await put(root, 'migration-profile.json', JSON.stringify(config));
  const result = await checkRepository(root, { configPath: 'migration-profile.json' });
  assert.deepEqual(result.findings, []);
  assert.equal(result.specs[0].path, 'PRODUCT/feature_specs/core/check_repository.md');
  assert.ok(
    result.model.documents.some(
      (doc) => doc.kind === 'page_contract' && doc.path === 'WEBSITE/pages/home/contract.toml',
    ),
  );
});
