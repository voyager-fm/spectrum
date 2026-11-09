import assert from 'node:assert/strict';
import test from 'node:test';
import { highlightLanguage, highlightLines, MAX_HIGHLIGHT_LENGTH } from './highlight.ts';

const text = (lines: { text: string }[][]) => lines.map((l) => l.map((t) => t.text).join(''));
const colorOf = (lines: { text: string; color?: string }[][], value: string) =>
  lines.flat().find((t) => t.text === value)?.color;

test('highlightLanguage resolves file extensions and fence aliases, and rejects unknown ones', () => {
  assert.equal(highlightLanguage('TOML'), 'toml');
  assert.equal(highlightLanguage('yml'), 'yaml');
  assert.equal(highlightLanguage('ts'), 'typescript');
  assert.equal(highlightLanguage('tsv'), 'tsv');
  assert.equal(highlightLanguage('mermaid'), null);
  assert.equal(highlightLanguage('constructor'), null);
  assert.equal(highlightLanguage(undefined), null);
});

test('highlightLines colors TOML with palette variables and keeps the source and line count', async () => {
  const source = '[contract]\nid = "spectrum.dashboard" # note\n\nread_only = true\n';
  const lines = await highlightLines(source, 'toml');
  assert.deepEqual(text(lines), [
    '[contract]',
    'id = "spectrum.dashboard" # note',
    '',
    'read_only = true',
  ]);
  assert.ok(lines[0]?.every((t) => t.bold));
  assert.equal(colorOf(lines, '"spectrum.dashboard"'), 'var(--code-string)');
  assert.equal(colorOf(lines, '# note'), 'var(--code-comment)');
  assert.equal(colorOf(lines, 'true'), 'var(--code-constant)');
  for (const token of lines.flat())
    if (token.color) assert.match(token.color, /^var\(--code-[a-z]+\)$/);
});

test('highlightLines distinguishes JSON keys from string values', async () => {
  const lines = await highlightLines('{"id": "DSH-001", "count": 2}', 'json');
  assert.equal(colorOf(lines, '"id"'), 'var(--code-key)');
  assert.equal(colorOf(lines, '"DSH-001"'), 'var(--code-string)');
  assert.equal(colorOf(lines, '2'), 'var(--code-constant)');
});

test('highlightLines bolds the TSV header and alternates column tones', async () => {
  const lines = await highlightLines('id\tname\tstatus\nA-1\tBrowse\tdraft', 'tsv');
  assert.deepEqual(text(lines), ['id\tname\tstatus', 'A-1\tBrowse\tdraft']);
  assert.ok(lines[0]?.filter((t) => t.text !== '\t').every((t) => t.bold));
  assert.equal(colorOf(lines, 'A-1'), undefined);
  assert.equal(colorOf(lines, 'Browse'), 'var(--code-string)');
  assert.equal(colorOf(lines, 'draft'), undefined);
});

test('every supported grammar loads and colors a sample with the JavaScript regex engine', async () => {
  const samples: Record<string, string> = {
    toml: 'a = "x"',
    json: '{"a": 1}',
    jsonc: '// note\n{"a": 1}',
    yaml: 'a: "x"',
    markdown: '# Title',
    typescript: 'const a: number = 1;',
    tsx: 'const a = <div className="x" />;',
    javascript: 'const a = "x";',
    jsx: 'const a = <b>x</b>;',
    shellscript: 'echo "hi" # note',
    diff: '+ added\n- removed',
    sql: "SELECT 'x' FROM t;",
    html: '<a href="x">y</a>',
    css: 'a { color: red; }',
  };
  for (const [lang, code] of Object.entries(samples)) {
    const lines = await highlightLines(code, lang);
    assert.deepEqual(text(lines), code.split('\n'), lang);
    assert.ok(
      lines.flat().some((t) => t.color),
      `${lang} produced no colored token`,
    );
  }
});

test('highlightLines normalizes CRLF line endings', async () => {
  const lines = await highlightLines('a = 1\r\nb = "x"\r\n', 'toml');
  assert.deepEqual(text(lines), ['a = 1', 'b = "x"']);
  assert.equal(colorOf(lines, '"x"'), 'var(--code-string)');
});

test('highlightLines leaves oversized sources plain', async () => {
  const source = `a = "${'x'.repeat(MAX_HIGHLIGHT_LENGTH)}"`;
  const lines = await highlightLines(source, 'toml');
  assert.deepEqual(lines, [[{ text: source }]]);
});

test('highlightLines returns plain lines for unknown languages', async () => {
  assert.deepEqual(await highlightLines('a = 1\n\nb', 'unknown'), [
    [{ text: 'a = 1' }],
    [],
    [{ text: 'b' }],
  ]);
});
