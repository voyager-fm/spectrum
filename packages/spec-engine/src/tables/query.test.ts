import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { test } from 'node:test';
import type { TableBinding } from './query.ts';
import { createTableQuery } from './query.ts';

async function fixture(
  t: TestContext,
  text = 'id\ttitle\n001\tAlpha 100% 원문\n002\tALPHA_under\n003\tTBD\n',
) {
  const root = await mkdtemp(join(tmpdir(), 'spectrum-query-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'billing/items'), { recursive: true });
  await writeFile(join(root, 'billing/items/data.tsv'), text);
  const tables: TableBinding[] = [
    { id: 'inventory:billing/items', path: 'billing/items/data.tsv', alias: 'items' },
  ];
  return { root, tables, query: await createTableQuery({ root, tables }) };
}

test('neutral explicit root/catalog preserves qualified identities and duplicate basenames', async (t) => {
  const { root, tables } = await fixture(t);
  await mkdir(join(root, 'shipping/items'), { recursive: true });
  await writeFile(join(root, 'shipping/items/data.tsv'), 'id\ttitle\n009\tOther\n');
  const query = await createTableQuery({
    root,
    tables: [...tables, { id: 'inventory:shipping/items', path: 'shipping/items/data.tsv' }],
  });
  assert.equal((await query.read({ table: 'items' })).table, 'inventory:billing/items');
  assert.equal((await query.read({ table: 'inventory:shipping/items' })).rows[0].id, '009');
  assert.equal(query.catalog().length, 2);
  await assert.rejects(query.read({ table: 'constructor' }), /Unknown table/);
  const copy = query.catalog();
  copy[0].path = 'missing.tsv';
  tables[0].path = 'missing.tsv';
  assert.equal((await query.read({ table: 'items' })).rows[0].id, '001');
});
test('catalog rejects duplicate IDs/aliases and implicit roots or unqualified IDs', async (t) => {
  const { root, tables } = await fixture(t);
  await assert.rejects(
    createTableQuery({ root, tables: [...tables, tables[0]] }),
    /Duplicate table ID/,
  );
  await assert.rejects(
    createTableQuery({ root, tables: [...tables, { ...tables[0], id: 'inventory:other' }] }),
    /Duplicate table alias/,
  );
  await assert.rejects(
    createTableQuery({ root, tables: [{ ...tables[0], id: 'items' }] }),
    /qualified/,
  );
  await assert.rejects(createTableQuery({ root: '.', tables }), /absolute/);
  await assert.rejects(
    createTableQuery({ root, tables: [{ ...tables[0], alias: 'bad-alias' }] }),
    /Invalid table alias/,
  );
});
test('literal case-insensitive search reports field matches and honest truncation', async (t) => {
  const { query } = await fixture(t);
  const result = await query.search({ table: 'items', query: 'alpha', limit: 1 });
  assert.equal(result.total_count, 2);
  assert.equal(result.returned_count, 1);
  assert.equal(result.truncated, true);
  assert.deepEqual(result.matched_fields, [['title']]);
  assert.equal(result.rows[0].id, '001');
  for (const needle of ['%', '_', '원문'])
    assert.equal((await query.search({ table: 'items', query: needle })).total_count, 1);
  assert.equal((await query.search({ table: 'items', query: 'alpa' })).total_count, 0);
  assert.equal(
    (await query.search({ table: 'items', query: 'alpha', fields: ['id'] })).total_count,
    0,
  );
  assert.equal((await query.search({ table: 'items', query: "' OR 1=1" })).total_count, 0);
});
test('read preserves placeholders, quotes, leading zeroes and source order without writes', async (t) => {
  const text =
    '\uFEFFid\ttitle\r\n001\t"hi ""there"""\r\n002\t-\r\n003\tTBD\r\n004\t<<AI>> 원문\r\n';
  const { root, query } = await fixture(t, text);
  const result = await query.read({ table: 'items', limit: 2 });
  assert.deepEqual(result.rows, [
    { id: '001', title: 'hi "there"' },
    { id: '002', title: '-' },
  ]);
  assert.equal(result.total_count, 4);
  assert.equal(result.truncated, true);
  assert.equal(result.root, await realpath(root));
  assert.equal(result.source, 'billing/items/data.tsv');
  assert.equal(result.snapshot.kind, 'worktree');
  assert.equal(result.snapshot.scope, 'selected-sources');
  assert.deepEqual(result.snapshot.paths, ['billing/items/data.tsv', 'billing/items/schema.json']);
  assert.equal(await readFile(join(root, 'billing/items/data.tsv'), 'utf8'), text);
});
test('schema is header/metadata description, not row/value/key validation', async (t) => {
  const { root, query } = await fixture(t, 'id\ttitle\nmalformed\n');
  const missing = await query.schema('items');
  assert.equal(missing.schema_status, 'missing');
  assert.equal(missing.schema_source, null);
  assert.equal(missing.dataValidation, 'notRun');
  await assert.rejects(query.read({ table: 'items' }), /expected 2 columns/);
  const contract = {
    columns: [
      { name: 'id', type: 'integer' },
      { name: 'title', required: true },
    ],
    primary_key: ['id'],
  };
  await writeFile(join(root, 'billing/items/schema.json'), `\uFEFF${JSON.stringify(contract)}`);
  assert.deepEqual((await query.schema('items')).contract, contract);
  await writeFile(
    join(root, 'billing/items/data.tsv'),
    'id\ttitle\nnot-integer\t\nnot-integer\t\n',
  );
  const result = await query.read({ table: 'items' });
  assert.equal(result.rows.length, 2);
  assert.equal(result.dataValidation, 'notRun');
});
test('schema errors include source, and cannot be mistaken for missing metadata', async (t) => {
  const { root, query } = await fixture(t);
  for (const raw of [
    '{',
    'null',
    '[]',
    '{}',
    '{"columns":[{"name":"title"},{"name":"id"}]}',
    '{"columns":[{"name":"id"},{"name":"title"}],"primary_key":["missing"]}',
  ]) {
    await writeFile(join(root, 'billing/items/schema.json'), raw);
    await assert.rejects(query.schema('items'), /billing\/items\/schema.json/);
    await assert.rejects(
      query.search({ table: 'items', query: 'alpha' }),
      /billing\/items\/schema.json/,
    );
  }
});
test('explicit schema bindings and opt-out work without branded defaults', async (t) => {
  const { root, tables } = await fixture(t);
  await writeFile(join(root, 'metadata.json'), '{"columns":[{"name":"id"},{"name":"title"}]}');
  const custom = await createTableQuery({
    root,
    tables: [{ ...tables[0], schemaPath: 'metadata.json' }],
  });
  assert.equal((await custom.schema('items')).schema_source, 'metadata.json');
  const disabled = await createTableQuery({ root, tables: [{ ...tables[0], schemaPath: null }] });
  assert.equal((await disabled.schema('items')).schema_status, 'disabled');
  assert.deepEqual((await disabled.read({ table: 'items' })).snapshot.paths, [
    'billing/items/data.tsv',
  ]);
});
test('schema and source escapes are rejected at read time', async (t) => {
  const { root, tables } = await fixture(t);
  const other = await fixture(t);
  await symlink(join(other.root, 'billing/items/data.tsv'), join(root, 'escape.tsv'));
  for (const binding of [
    { ...tables[0], path: '../data.tsv' },
    { ...tables[0], path: 'escape.tsv' },
    { ...tables[0], schemaPath: '../metadata.json' },
  ]) {
    const query = await createTableQuery({ root, tables: [binding] });
    await assert.rejects(query.read({ table: 'items' }), /escapes/);
  }
  await symlink(
    join(other.root, 'billing/items/data.tsv'),
    join(root, 'billing/items/schema.json'),
  );
  await assert.rejects((await createTableQuery({ root, tables })).schema('items'), /escapes/);
});
test('sequential/concurrent roots and repeated calls never share cached customer data', async (t) => {
  const a = await fixture(t, 'id\ttitle\n001\tFirst\n');
  const b = await fixture(t, 'id\ttitle\n002\tSecond\n');
  const [first, second] = await Promise.all([
    a.query.read({ table: 'items' }),
    b.query.read({ table: 'items' }),
  ]);
  assert.equal(first.rows[0].title, 'First');
  assert.equal(second.rows[0].title, 'Second');
  await writeFile(join(a.root, 'billing/items/data.tsv'), 'id\ttitle\n003\tChanged\n');
  assert.equal((await a.query.read({ table: 'items' })).rows[0].title, 'Changed');
  assert.equal((await b.query.read({ table: 'items' })).rows[0].title, 'Second');
});
test('selected-content digest detects stale source and metadata without claiming a commit', async (t) => {
  const { root, tables, query } = await fixture(t);
  const before = await query.read({ table: 'items' });
  const pinned = await createTableQuery({
    root,
    tables,
    snapshot: { kind: 'worktree', contentDigest: before.snapshot.contentDigest },
  });
  await writeFile(join(root, 'unrelated.txt'), 'not selected');
  assert.equal(
    (await pinned.read({ table: 'items' })).snapshot.contentDigest,
    before.snapshot.contentDigest,
  );
  await writeFile(
    join(root, 'billing/items/schema.json'),
    '{"columns":[{"name":"id"},{"name":"title"}]}',
  );
  await assert.rejects(pinned.read({ table: 'items' }), /Stale snapshot/);
  await assert.rejects(
    createTableQuery({ root, tables, snapshot: { kind: 'commit', revision: 'HEAD' } }),
    /not supported/,
  );
});
test('invalid selection, empty query and limits fail instead of silently returning partial results', async (t) => {
  const { query } = await fixture(t);
  for (const limit of [0, -1, 1.5, 10001, NaN])
    await assert.rejects(query.read({ table: 'items', limit }), /Invalid limit/);
  for (const fields of [[], ['missing']])
    await assert.rejects(query.search({ table: 'items', query: 'a', fields }), /column selection/);
  await assert.rejects(query.search({ table: 'items', query: '  ' }), /non-empty/);
});
test('empty explicit catalog supports Markdown-only customer roots', async (t) => {
  const { root } = await fixture(t);
  const query = await createTableQuery({ root, tables: [] });
  assert.deepEqual(query.catalog(), []);
  await assert.rejects(query.schema('items'), /Unknown table/);
});
