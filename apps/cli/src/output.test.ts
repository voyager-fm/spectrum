import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import type { CheckResult, Finding, Spec } from '@spectrum/core';
import { checkRepository } from '@spectrum/spec-engine';
import { loadTemplate, renderTemplate } from '@spectrum/spec-engine/templates';
import { formatCheckResult, formatSpecList, parseOutputFormat } from './output.ts';

function result(findings: Finding[] = [], specs: Spec[] = []): CheckResult {
  return {
    ok: !findings.some((finding) => finding.severity === 'error'),
    findings,
    specs,
    config: null,
    model: { inventories: [], documents: [], relationships: [] },
  };
}
function spec(): Spec {
  return {
    id: 'CUSTOM-α',
    featureId: 'FEATURE-001',
    categoryKey: 'customer',
    title: 'Open 원문',
    status: 'in_review',
    implementationStatus: 'planned',
    phase: 'next',
    path: '.spectrum/features/open/spec.md',
    body: 'Original body',
    links: [],
    acceptance: [
      {
        id: 'AC-001',
        statement: 'Preserves 001 and 원문',
        checked: true,
        verification: 'not_recorded',
      },
      { id: null, statement: 'Second\ncriterion', checked: false, verification: 'not_recorded' },
    ],
  };
}

test('output format defaults to JSON and rejects unknown/unsupported combinations', () => {
  assert.equal(parseOutputFormat(), 'json');
  assert.equal(parseOutputFormat(undefined, true), 'json');
  assert.equal(parseOutputFormat('text'), 'text');
  assert.equal(parseOutputFormat('github', true), 'github');
  assert.throws(() => parseOutputFormat('github'), /only for check/);
  for (const value of ['', 'JSON', 'xml', ' text '])
    assert.throws(() => parseOutputFormat(value, true), /Unsupported output format/);
  assert.throws(
    () => Reflect.apply(formatSpecList, undefined, [result(), 'github']),
    /only for check/,
  );
  assert.throws(
    () => Reflect.apply(formatCheckResult, undefined, [result(), 'xml']),
    /Unsupported output format/,
  );
});

test('default JSON preserves the raw full check result and raw spec-array list shapes', () => {
  const input = result(
    [{ severity: 'warning', path: 'a.md', line: 3, code: 'W', message: '原文\nnext' }],
    [spec()],
  );
  assert.equal(formatCheckResult(input), JSON.stringify(input, null, 2));
  assert.equal(formatSpecList(input), JSON.stringify(input.specs, null, 2));
  assert.deepEqual(JSON.parse(formatCheckResult(input, 'json')), input);
  assert.deepEqual(JSON.parse(formatSpecList(input, 'json')), input.specs);
});

test('text reports structural status separately from warnings and review/AC annotations', () => {
  const input = result(
    [
      {
        severity: 'warning',
        path: 'docs/원문.md',
        line: 4,
        code: 'MISSING_LINK',
        message: 'Target not found',
      },
    ],
    [spec()],
  );
  assert.equal(
    formatCheckResult(input, 'text'),
    'Structural check: PASS | 0 error(s), 1 warning(s) | 1 spec(s)\nWARNING docs/원문.md:4 [MISSING_LINK] Target not found',
  );
  const list = formatSpecList(input, 'text');
  assert.match(list, /CUSTOM-α — Open 원문/);
  assert.match(list, /feature: FEATURE-001 \| review: in_review \| implementation: planned/);
  assert.match(list, /AC: 2 total, 1 annotated checked; execution verification: not recorded/);
  assert.match(list, /\[x\] AC-001: Preserves 001 and 원문/);
  assert.ok(list.includes('[ ] (no ID): Second\\ncriterion'));
});

test('text shows errors, empty results and line-oriented multiline/control values', () => {
  const input = result([
    {
      severity: 'error',
      path: 'bad\npath',
      code: 'BAD\tCODE',
      message: 'first\r\n::error::second\u001b[31m',
    },
  ]);
  assert.equal(
    formatCheckResult(input, 'text'),
    'Structural check: FAIL | 1 error(s), 0 warning(s) | 0 spec(s)\nERROR bad\\npath [BAD\\tCODE] first\\r\\n::error::second\\u001b[31m',
  );
  assert.equal(
    formatSpecList(result(), 'text'),
    'Structural check: PASS | 0 error(s), 0 warning(s) | 0 spec(s)\nNo specs found.',
  );
  assert.equal(formatSpecList(result()), '[]');
  assert.equal(
    formatCheckResult(result(), 'github'),
    'Structural check: PASS | 0 error(s), 0 warning(s) | 0 spec(s)',
  );
});

test('GitHub escapes annotation properties/data once and cannot inject extra command lines', () => {
  const input = result([
    {
      severity: 'error',
      path: 'docs/a,b:c%25.md',
      line: 7,
      code: 'CODE%,:\r\n::warning::injected',
      message: '원문 100% %0A\r\n::error file=other.md::injected, colon: retained',
    },
    { severity: 'warning', path: 'docs/other.md', code: 'WARN', message: 'warning' },
  ]);
  const output = formatCheckResult(input, 'github');
  assert.equal(
    output,
    [
      'Structural check: FAIL | 1 error(s), 1 warning(s) | 0 spec(s)',
      '::error title=CODE%25%2C%3A%0D%0A%3A%3Awarning%3A%3Ainjected,file=docs/a%2Cb%3Ac%2525.md,line=7::원문 100%25 %250A%0D%0A::error file=other.md::injected, colon: retained',
      '::warning title=WARN,file=docs/other.md::warning',
    ].join('\n'),
  );
  assert.equal(output.split('\n').length, 3);
  assert.equal(output.split('\n').filter((line) => line.startsWith('::error ')).length, 1);
});

test('GitHub omits unsafe/outside paths and their line attributes', () => {
  const paths = [
    '',
    '.',
    '..',
    '../outside.md',
    'a/../../outside.md',
    '/tmp/outside.md',
    'C:\\outside.md',
    'C:outside.md',
    '\\\\server\\share.md',
    'https://example.test/a.md',
    'a\n::error::injected',
    'a\r.md',
    'a\u0000.md',
    'a\\..\\outside.md',
  ];
  for (const path of paths) {
    const output = formatCheckResult(
      result([{ severity: 'error', path, line: 9, code: 'BAD', message: 'kept' }]),
      'github',
    );
    assert.equal(output.split('\n')[1], '::error title=BAD::kept', JSON.stringify(path));
  }
});

test('GitHub normalizes safe relative paths and emits only positive safe integer lines', () => {
  const valid = formatCheckResult(
    result([{ severity: 'warning', path: '.\\docs\\원문.md', line: 2, code: 'W', message: 'ok' }]),
    'github',
  );
  assert.ok(valid.endsWith('::warning title=W,file=docs/원문.md,line=2::ok'));
  for (const line of [undefined, 0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    const output = formatCheckResult(
      result([{ severity: 'warning', path: 'docs/a.md', line, code: 'W', message: 'ok' }]),
      'github',
    );
    assert.ok(output.endsWith('::warning title=W,file=docs/a.md::ok'));
  }
});

test('all formatters leave deeply frozen checker input untouched', () => {
  const input = result(
    [{ severity: 'warning', path: 'a.md', code: 'W', message: 'look' }],
    [spec()],
  );
  const original = structuredClone(input);
  function freeze(value: unknown) {
    if (value !== null && typeof value === 'object') {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
  }
  freeze(input);
  for (const format of ['json', 'text', 'github'] as const) formatCheckResult(input, format);
  for (const format of ['json', 'text'] as const) formatSpecList(input, format);
  assert.deepEqual(input, original);
});

test('formatters consume actual engine diagnostics from a disposable customer root', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'spectrum-cli-output-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'README.md'), '# Neutral customer\n');
  const checked = await checkRepository(root);
  assert.equal(checked.ok, false);
  assert.ok(checked.findings.length > 0);
  assert.deepEqual(JSON.parse(formatCheckResult(checked)), checked);
  assert.deepEqual(JSON.parse(formatSpecList(checked)), checked.specs);
  assert.match(formatCheckResult(checked, 'text'), /^Structural check: FAIL/);
  assert.match(formatCheckResult(checked, 'github'), /\n::error /);
});

test('list consumes a real spec parsed from the canonical engine template API', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'spectrum-cli-output-template-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const template = await loadTemplate('feature.interaction');
  const values: Record<string, string> = {};
  for (const match of `${template.output}\n${template.content}`.matchAll(
    /\{\{(?:text|json|tsv|path):([a-z_]+)\}\}/g,
  )) {
    values[match[1]] = 'TBD';
  }
  Object.assign(values, {
    category_key: 'READ',
    feature_id: 'READ-001',
    interaction_id: 'READ-001-read',
    feature_title: 'Read records',
    interaction_title: 'Read 원문',
    acceptance_criterion: 'Preserve original strings.',
  });
  const rendered = await renderTemplate('feature.interaction', values);
  await mkdir(dirname(join(root, rendered.path)), { recursive: true });
  await writeFile(join(root, rendered.path), rendered.content);
  for (const id of ['inventory.custom.schema', 'inventory.custom.data']) {
    const output = await renderTemplate(id, {
      table_key: 'records',
      table_name: 'RECORDS',
      record_key: 'first',
      description: 'A local record.',
    });
    await mkdir(dirname(join(root, output.path)), { recursive: true });
    await writeFile(join(root, output.path), output.content);
  }
  const checked = await checkRepository(root, {
    config: {
      schema_version: 2,
      name: 'Neutral customer',
      mode: 'proposal-only',
      canonical_source: 'git-files',
      inventories: [
        {
          kind: 'other',
          data: '.spectrum/custom/records/data.tsv',
          schema: '.spectrum/custom/records/schema.json',
        },
      ],
      documents: [{ kind: 'feature_bundle', root: '.spectrum/product/feature_specs' }],
    },
  });
  // One template intentionally does not supply its contract/flow: keep real findings, not a success mock.
  assert.equal(checked.specs.length, 1);
  assert.equal(checked.specs[0].id, values.interaction_id);
  assert.deepEqual(JSON.parse(formatSpecList(checked)), checked.specs);
  const text = formatSpecList(checked, 'text');
  assert.match(text, /READ-001-read — Read 원문/);
  assert.match(text, /review: draft/);
  assert.match(text, /execution verification: not recorded/);
  assert.match(text, /AC-1: Preserve original strings\./);
});
