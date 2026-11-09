import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Finding, RepositoryModel, Spec } from '@spectrum/core';
import {
  acceptanceCoverage,
  axisTicks,
  categoryBreakdown,
  categoryOrder,
  checkTrend,
  findingViewQuery,
  groupFindings,
  OUTSIDE_SPECS,
  parseFindingView,
  share,
  statusDistribution,
} from './overview.ts';

function spec(id: string, overrides: Partial<Spec> = {}): Spec {
  return {
    id,
    featureId: id.split('-').slice(0, 2).join('-'),
    categoryKey: id.split('-')[0],
    title: id,
    status: 'draft',
    implementationStatus: 'planned',
    phase: 'now',
    path: `specs/${id}.md`,
    body: '',
    acceptance: [],
    links: [],
    ...overrides,
  };
}

const ac = (id: string | null, checked = false) => ({
  id,
  statement: 'x',
  checked,
  verification: 'not_recorded' as const,
});

function finding(path: string, code: string, severity: Finding['severity'] = 'error'): Finding {
  return { path, code, severity, message: `${code} at ${path}` };
}

describe('statusDistribution', () => {
  const specs = [
    spec('VAL-001-a', { status: 'approved', implementationStatus: 'implementing' }),
    spec('VAL-001-b', { status: 'draft', implementationStatus: 'idea', phase: 'next' }),
    spec('DSH-001-a', { status: 'draft', implementationStatus: 'custom_state' }),
    spec('DSH-001-b', { status: 'in_review', implementationStatus: '', phase: '' }),
  ];

  it('keeps review, lifecycle and phase separate and counts each spec once', () => {
    const d = statusDistribution(specs);
    assert.equal(d.total, 4);
    for (const parts of [d.review, d.lifecycle, d.phase]) {
      assert.equal(
        parts.reduce((n, p) => n + p.count, 0),
        4,
      );
    }
    assert.deepEqual(d.review, [
      { value: 'draft', count: 2 },
      { value: 'in_review', count: 1 },
      { value: 'approved', count: 1 },
    ]);
  });

  it('orders known lifecycle values first and keeps repository values by name', () => {
    const d = statusDistribution(specs);
    assert.deepEqual(
      d.lifecycle.map((p) => p.value),
      ['idea', 'implementing', 'custom_state', 'unset'],
    );
    assert.deepEqual(d.phase, [
      { value: 'now', count: 2 },
      { value: 'next', count: 1 },
      { value: 'unset', count: 1 },
    ]);
  });

  it('returns empty distributions without specs', () => {
    assert.deepEqual(statusDistribution([]), { total: 0, review: [], lifecycle: [], phase: [] });
  });
});

describe('categoryBreakdown', () => {
  it('counts specs, criteria and findings per category in repository order', () => {
    const specs = [
      spec('VAL-001-a', { acceptance: [ac('AC-1'), ac('AC-2')] }),
      spec('DSH-001-a', { acceptance: [ac('AC-1')] }),
      spec('DSH-001-b'),
      spec('ZZZ-001-a'),
    ];
    const findings = [
      finding('specs/DSH-001-a.md', 'broken-link'),
      finding('specs/DSH-001-b.md', 'tbd', 'warning'),
      finding('.spectrum/config.json', 'invalid-config'),
    ];
    const rows = categoryBreakdown(specs, findings, ['DSH', 'VAL', 'SET']);
    assert.deepEqual(
      rows.map((r) => [r.categoryKey, r.specs, r.acceptance, r.findings]),
      [
        ['DSH', 2, 1, 2],
        ['VAL', 1, 2, 0],
        ['ZZZ', 1, 0, 0],
      ],
    );
  });
});

describe('acceptanceCoverage', () => {
  it('counts stable IDs, ticked boxes and specs without criteria', () => {
    const a = spec('VAL-001-a', { acceptance: [ac('AC-1', true), ac(null), ac(null)] });
    const b = spec('VAL-001-b', { acceptance: [ac('AC-1')] });
    const c = spec('VAL-001-c');
    const cov = acceptanceCoverage([a, b, c]);
    assert.equal(cov.total, 4);
    assert.equal(cov.withId, 2);
    assert.equal(cov.ticked, 1);
    assert.deepEqual(
      cov.withoutCriteria.map((s) => s.id),
      ['VAL-001-c'],
    );
    assert.deepEqual(
      cov.missingIds.map((m) => [m.spec.id, m.count]),
      [['VAL-001-a', 2]],
    );
  });
});

describe('parseFindingView', () => {
  it('reads known values and falls back for unknown ones', () => {
    assert.deepEqual(parseFindingView({ group: 'path', severity: 'warning' }), {
      group: 'path',
      severity: 'warning',
    });
    assert.deepEqual(parseFindingView({ group: 'owner', severity: ['fatal'] }), {
      group: 'code',
      severity: 'all',
    });
    assert.deepEqual(parseFindingView({}), { group: 'code', severity: 'all' });
  });
});

describe('groupFindings', () => {
  const specs = [spec('VAL-001-a'), spec('VAL-001-b')];
  const findings = [
    finding('specs/VAL-001-a.md', 'broken-link'),
    finding('specs/VAL-001-a.md', 'tbd', 'warning'),
    finding('specs/VAL-001-b.md', 'broken-link'),
    finding('inventory/data.tsv', 'missing-ref'),
    finding('inventory/data.tsv', 'missing-ref'),
    finding('inventory/data.tsv', 'missing-ref', 'warning'),
  ];

  it('puts every finding in exactly one group, largest first', () => {
    for (const group of ['code', 'path', 'spec'] as const) {
      const g = groupFindings(findings, specs, { group, severity: 'all' });
      assert.equal(g.total, 6);
      assert.equal(g.shown, 6);
      assert.equal(
        g.groups.reduce((n, x) => n + x.findings.length, 0),
        6,
        group,
      );
    }
    const byCode = groupFindings(findings, specs, { group: 'code', severity: 'all' });
    assert.deepEqual(
      byCode.groups.map((x) => [x.key, x.errors, x.warnings]),
      [
        ['missing-ref', 2, 1],
        ['broken-link', 2, 0],
        ['tbd', 0, 1],
      ],
    );
  });

  it('groups by spec and keeps findings outside specs last', () => {
    const bySpec = groupFindings(findings, specs, { group: 'spec', severity: 'all' });
    assert.deepEqual(
      bySpec.groups.map((x) => [x.key, x.spec?.id ?? null, x.findings.length]),
      [
        ['VAL-001-a', 'VAL-001-a', 2],
        ['VAL-001-b', 'VAL-001-b', 1],
        [OUTSIDE_SPECS, null, 3],
      ],
    );
  });

  it('filters by severity and reports the shown count', () => {
    const errors = groupFindings(findings, specs, { group: 'path', severity: 'error' });
    assert.equal(errors.shown, 4);
    assert.equal(errors.total, 6);
    assert.ok(errors.groups.every((x) => x.warnings === 0));
    const none = groupFindings([], specs, { group: 'code', severity: 'warning' });
    assert.deepEqual(none, { total: 0, shown: 0, groups: [] });
  });
});

describe('checkTrend', () => {
  it('orders stored checks oldest first without changing them', () => {
    const rows = [
      { sha: 'c', ok: true, errors: 0, warnings: 1, specs: 3, analyzedAt: '2026-11-09T03:00:00Z' },
      { sha: 'a', ok: false, errors: 2, warnings: 0, specs: 2, analyzedAt: '2026-11-08T01:00:00Z' },
      { sha: 'b', ok: true, errors: 0, warnings: 0, specs: 3, analyzedAt: '2026-11-09T01:00:00Z' },
    ];
    assert.deepEqual(
      checkTrend(rows).map((r) => r.sha),
      ['a', 'b', 'c'],
    );
    assert.equal(rows[0].sha, 'c');
  });
});

describe('axisTicks', () => {
  it('rounds up to clean steps from zero', () => {
    assert.deepEqual(axisTicks(0), [0, 1]);
    assert.deepEqual(axisTicks(3), [0, 1, 2, 3]);
    assert.deepEqual(axisTicks(7), [0, 2, 4, 6, 8]);
    assert.deepEqual(axisTicks(38), [0, 10, 20, 30, 40]);
  });
});

describe('share', () => {
  it('rounds to whole percentages and marks tiny shares', () => {
    assert.equal(share(1, 3), '33%');
    assert.equal(share(0, 0), '0%');
    assert.equal(share(1, 400), '<1%');
  });
});

describe('findingViewQuery', () => {
  it('keeps the selected revision and omits defaults', () => {
    assert.equal(findingViewQuery('', { group: 'code', severity: 'all' }), '');
    assert.equal(
      findingViewQuery('?ref=feature%2Fx', { group: 'spec', severity: 'error' }),
      '?ref=feature%2Fx&group=spec&severity=error',
    );
    assert.equal(
      findingViewQuery('?pr=12&group=path', { group: 'code', severity: 'warning' }),
      '?pr=12&severity=warning',
    );
  });
});

describe('categoryOrder', () => {
  it('reads category keys in the declared order and ignores other inventories', () => {
    const inventory = (kind: string, rows: Record<string, string>[]) =>
      ({
        kind,
        path: `${kind}.tsv`,
        schemaPath: 'schema.json',
        schema: { schema_version: '1', name: kind, primary_key: [], columns: [] },
        rows: rows.map((values, i) => ({ line: i + 2, values })),
      }) as unknown as RepositoryModel['inventories'][number];
    const model = {
      inventories: [
        inventory('categories', [
          { order: '2', category_key: 'DSH' },
          { order: '1', category_key: 'VAL' },
          { order: '3', category_key: '' },
        ]),
        inventory('features', [{ category_key: 'ZZZ' }]),
      ],
    };
    assert.deepEqual(categoryOrder(model), ['VAL', 'DSH']);
    assert.deepEqual(categoryOrder({ inventories: [] }), []);
  });
});
