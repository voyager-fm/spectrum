/** TSV dialect and selected-source read-session regressions. */

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createTableQuery } from './query.ts';
import { createReadSession, parseTable, parseTsvLine } from './reader.ts';

for (const [name, text, error] of [
  ['empty header', '', /header/],
  ['duplicate header', 'a\ta\nx\ty\n', /duplicate/],
  ['ragged row', 'a\tb\nx\n', /expected 2 columns/],
  ['extra column', 'a\nb\tc\n', /expected 1 columns/],
  ['blank row', 'a\nx\n\n', /empty TSV row/],
  ['quoted multiline', 'a\n"hello\nworld"\n', /quoted/],
  ['quoted tab', 'a\n"hello\tworld"\n', /quoted/],
  ['unescaped inner quote', 'a\n"hello"world"\n', /quoted/],
] as const) {
  test(`TSV parser rejects ${name}`, () => assert.throws(() => parseTable(text, 'fixture'), error));
}
test('TSV parsing preserves original strings and freezes rows', () => {
  const table = parseTable(
    '\uFEFFa\tb\tc\td\r\n"hi ""there"""\t001\tTBD\t<<AI>> 원문\r\n',
    'fixture',
  );
  assert.deepEqual(table.rows[0], { a: 'hi "there"', b: '001', c: 'TBD', d: '<<AI>> 원문' });
  assert.ok(Object.isFrozen(table.rows[0]));
  assert.deepEqual(parseTsvLine('"a ""quote"""\tO\'Brien\t-\t001', 'fixture', 2), [
    'a "quote"',
    "O'Brien",
    '-',
    '001',
  ]);
});
test('worktree transaction detects edits and optional schemas appearing during a query', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spectrum-session-'));
  try {
    await writeFile(join(root, 'data.tsv'), 'id\n001\n');
    const canonicalRoot = await realpath(root);
    const session = createReadSession(canonicalRoot);
    await session.read('data.tsv');
    await writeFile(join(root, 'data.tsv'), 'id\n002\n');
    await assert.rejects(session.finish(), /changed during query/);
    const optional = createReadSession(canonicalRoot);
    assert.equal(await optional.optional('schema.json'), null);
    await writeFile(join(root, 'schema.json'), '{}');
    await assert.rejects(optional.finish(), /changed during query/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('table metadata rejects malformed JSON, null, header drift and unknown PK', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spectrum-schema-'));
  try {
    await writeFile(join(root, 'data.tsv'), 'id\n001\n');
    const harness = await createTableQuery({
      root,
      tables: [{ id: 'inventory:test', path: 'data.tsv' }],
    });
    assert.equal((await harness.schema('inventory:test')).contract, null);
    for (const raw of [
      '{',
      'null',
      '{"columns":[{"name":"other"}]}',
      '{"columns":[{"name":"id"}],"primary_key":["missing"]}',
    ]) {
      await writeFile(join(root, 'schema.json'), raw);
      await assert.rejects(harness.schema('inventory:test'));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('read sessions reject traversal and escaping symlinks, including dangling optional sources', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'spectrum-boundary-'));
  const outside = await mkdtemp(join(tmpdir(), 'spectrum-outside-'));
  t.after(() =>
    Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(outside, { recursive: true, force: true }),
    ]),
  );
  await writeFile(join(outside, 'data.tsv'), 'id\nsecret\n');
  await symlink(join(outside, 'data.tsv'), join(root, 'file.tsv'));
  await symlink(outside, join(root, 'directory'));
  await symlink(join(outside, 'missing.json'), join(root, 'schema.json'));
  const session = createReadSession(root);
  for (const path of ['../escape.tsv', 'file.tsv', 'directory/data.tsv'])
    await assert.rejects(session.read(path), /escapes/);
  await assert.rejects(session.optional('directory/missing.json'), /escapes/);
  await assert.rejects(session.optional('schema.json'), /escapes/);
  await assert.rejects(session.read(join(outside, 'data.tsv')), /relative source path/);
});
test('read sessions accept internal links and pin their observed targets', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'spectrum-internal-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'nested'));
  await writeFile(join(root, 'nested/a.tsv'), 'id\n001\n');
  await writeFile(join(root, 'nested/b.tsv'), 'id\n001\n');
  await symlink('nested/a.tsv', join(root, 'data.tsv'));
  const session = createReadSession(root);
  assert.equal(await session.read('data.tsv'), 'id\n001\n');
  await rm(join(root, 'data.tsv'));
  await symlink('nested/b.tsv', join(root, 'data.tsv'));
  await assert.rejects(session.finish(), /changed during query/);
});
test('read sessions reject deleted observations and invalid UTF-8', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'spectrum-observation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'data.tsv'), 'id\n001\n');
  const session = createReadSession(root);
  await session.read('data.tsv');
  await rm(join(root, 'data.tsv'));
  await assert.rejects(session.finish(), /changed during query/);
  await assert.rejects(session.optional('data.tsv'), /changed during query/);
  await writeFile(join(root, 'data.tsv'), Buffer.from([0xff]));
  await assert.rejects(createReadSession(root).read('data.tsv'), /encoded data/);
});
