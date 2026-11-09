import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CheckResult, Inventory, RepositoryDocument, Spec } from '@spectrum/core';
import { markdownView } from '@spectrum/spec-engine/markdown';
import {
  adjacentSpecs,
  documentHref,
  EMPTY_FILTER,
  facet,
  filterRows,
  interactionRows,
  linkContext,
  outline,
  type ReaderRoutes,
  readerTree,
  relatedDocuments,
  remoteRoutes,
  resolveLink,
  searchEntries,
  searchMatches,
  specHref,
} from './reader.ts';

const SPECS = '.spectrum/specs';

function table(kind: Inventory['kind'], rows: Record<string, string>[]): Inventory {
  return {
    kind,
    path: `${kind}.tsv`,
    schemaPath: 'schema.json',
    schema: { schema_version: '2', name: kind, primary_key: [], columns: [] },
    rows: rows.map((values, i) => ({ line: i + 2, values })),
  };
}

function spec(id: string, feature: string, category: string, acceptance = 1): Spec {
  return {
    id,
    featureId: feature,
    categoryKey: category,
    title: `Title ${id}`,
    status: 'draft',
    implementationStatus: 'implementing',
    phase: 'now',
    path: `${SPECS}/${id}.md`,
    body: `# Title ${id}\n\n## Intent\n\nText.\n`,
    acceptance: Array.from({ length: acceptance }, (_, i) => ({
      id: `AC-${i + 1}`,
      statement: `Criterion ${i + 1} of ${id}`,
      checked: false,
      verification: 'not_recorded' as const,
    })),
    links: [],
  };
}

function doc(kind: RepositoryDocument['kind'], path: string, title: string): RepositoryDocument {
  return { kind, path, title, body: '', metadata: {}, links: [] };
}

function interaction(id: string, category: string, feature: string, status: string) {
  return {
    interaction_id: id,
    interaction_title: `Title ${id}`,
    interaction_type: 'display',
    category_key: category,
    feature_id: feature,
    status,
    phase: status === 'idea' ? 'later' : 'now',
    summary: `Summary of ${id}`,
    related_region: 'web.specs',
  };
}

function fixture(): CheckResult {
  const specs = [
    spec('VAL-001-check', 'VAL-001', 'VAL', 2),
    spec('DSH-001-browse', 'DSH-001', 'DSH'),
  ];
  const flow = doc('flow', '.spectrum/flows/browse.md', 'Browse flow');
  return {
    ok: false,
    findings: [
      {
        code: 'broken-link',
        message: 'Missing',
        path: `${SPECS}/DSH-001-browse.md`,
        severity: 'error',
      },
    ],
    specs,
    config: null,
    model: {
      inventories: [
        table('categories', [
          { order: '2', category_key: 'DSH', category_title: 'Dashboard' },
          { order: '1', category_key: 'VAL', category_title: 'Validation' },
        ]),
        table('features', [
          { feature_id: 'VAL-001', feature_title: 'Validation feature' },
          { feature_id: 'DSH-001', feature_title: 'Browsing feature' },
        ]),
        table('interactions', [
          interaction('DSH-001-browse', 'DSH', 'DSH-001', 'implementing'),
          interaction('DSH-001-idea', 'DSH', 'DSH-001', 'idea'),
          interaction('VAL-001-check', 'VAL', 'VAL-001', 'implementing'),
        ]),
      ],
      documents: [
        ...specs.map((s) => ({ ...doc('interaction', s.path, s.title), body: s.body })),
        flow,
      ],
      relationships: [
        { kind: 'document_link', source: `${SPECS}/VAL-001-check.md`, target: flow.path },
        { kind: 'document_link', source: `${SPECS}/DSH-001-browse.md`, target: flow.path },
        { kind: 'document_link', source: flow.path, target: `${SPECS}/VAL-001-check.md` },
      ],
    },
  };
}

const LOCAL: ReaderRoutes = { base: '/specs', query: '' };

test('interactionRows joins the inventory with spec documents in category order', () => {
  const rows = interactionRows(fixture());
  assert.deepEqual(
    rows.map((r) => [
      r.id,
      r.categoryTitle,
      r.featureTitle,
      r.lifecycle,
      r.spec?.acceptance ?? null,
    ]),
    [
      ['VAL-001-check', 'Validation', 'Validation feature', 'implementing', 2],
      ['DSH-001-browse', 'Dashboard', 'Browsing feature', 'implementing', 1],
      ['DSH-001-idea', 'Dashboard', 'Browsing feature', 'idea', null],
    ],
  );
  assert.deepEqual(
    rows.map((r) => r.errors),
    [0, 1, 0],
  );
});

test('a spec missing from the inventory is still listed', () => {
  const result = fixture();
  result.specs.push(spec('VAL-002-orphan', 'VAL-002', 'VAL'));
  const orphan = interactionRows(result).find((r) => r.id === 'VAL-002-orphan');
  assert.equal(orphan?.spec?.path, `${SPECS}/VAL-002-orphan.md`);
  assert.equal(orphan?.lifecycle, 'implementing');
});

test('readerTree groups interactions under categories and features, documents by kind', () => {
  const result = fixture();
  const tree = readerTree(interactionRows(result), result.model.documents, LOCAL);
  assert.deepEqual(
    tree.categories.map((c) => [c.key, c.features.map((f) => f.interactions.map((i) => i.id))]),
    [
      ['VAL', [['VAL-001-check']]],
      ['DSH', [['DSH-001-browse', 'DSH-001-idea']]],
    ],
  );
  assert.equal(tree.categories[1]?.features[0]?.interactions[1]?.hasSpec, false);
  assert.deepEqual(tree.groups, [
    {
      label: 'Flows',
      documents: [
        {
          path: '.spectrum/flows/browse.md',
          title: 'Browse flow',
          href: '/specs/documents/.spectrum/flows/browse.md',
        },
      ],
    },
  ]);
});

test('surface bundle documents are listed with pages', () => {
  const result = fixture();
  const docs = [
    doc('surface_contract', '.spectrum/surfaces/web/specs/contract.toml', 'Specs contract'),
    doc('surface_spec', '.spectrum/surfaces/web/specs/spec.md', 'Specs surface'),
  ];
  const tree = readerTree(interactionRows(result), docs, LOCAL);
  assert.deepEqual(
    tree.groups.map((g) => [g.label, g.documents.map((d) => d.title)]),
    [['Pages', ['Specs contract', 'Specs surface']]],
  );
});

test('resolveLink maps written links to reader pages, sources or nothing', () => {
  const result = fixture();
  const local = linkContext(result, LOCAL);
  const from = `${SPECS}/VAL-001-check.md`;
  assert.deepEqual(resolveLink(from, './DSH-001-browse.md#intent', local), {
    kind: 'internal',
    href: '/specs/DSH-001-browse#intent',
  });
  assert.deepEqual(resolveLink(from, '../flows/browse.md', local), {
    kind: 'internal',
    href: '/specs/documents/.spectrum/flows/browse.md',
  });
  assert.deepEqual(resolveLink(from, '#intent', local), { kind: 'internal', href: '#intent' });
  assert.deepEqual(resolveLink(from, 'https://example.com', local), {
    kind: 'external',
    href: 'https://example.com',
  });
  // Not a loaded document and no source URL locally: shown as text.
  assert.deepEqual(resolveLink(from, '../../apps/web/x.ts', local), { kind: 'none' });
  // Escaping the repository or using another scheme is never linked.
  assert.deepEqual(resolveLink(from, '../../../../etc/passwd', local), { kind: 'none' });
  assert.deepEqual(resolveLink(from, 'javascript:alert(1)', local), { kind: 'none' });

  const remote = linkContext(
    result,
    remoteRoutes('/repositories/o/r/specs', '?ref=dev', 'https://github.com/o/r', 'abc123'),
  );
  assert.deepEqual(resolveLink(from, './DSH-001-browse.md', remote), {
    kind: 'internal',
    href: '/repositories/o/r/specs/DSH-001-browse?ref=dev',
  });
  assert.deepEqual(resolveLink(from, '../../apps/web/x.ts', remote), {
    kind: 'external',
    href: 'https://github.com/o/r/blob/abc123/apps/web/x.ts',
  });
});

test('hrefs encode IDs and keep each path segment', () => {
  const routes = { base: '/repositories/o/r/specs', query: '?pr=4' };
  assert.equal(specHref(routes, 'A B'), '/repositories/o/r/specs/A%20B?pr=4');
  assert.equal(
    documentHref(routes, '.spectrum/a b/c.md'),
    '/repositories/o/r/specs/documents/.spectrum/a%20b/c.md?pr=4',
  );
});

test('relatedDocuments lists links in both directions', () => {
  const result = fixture();
  const related = relatedDocuments('.spectrum/flows/browse.md', result, linkContext(result, LOCAL));
  assert.deepEqual(
    related.linksTo.map((d) => d.path),
    [`${SPECS}/VAL-001-check.md`],
  );
  assert.deepEqual(
    related.linkedFrom.map((d) => d.path),
    [`${SPECS}/DSH-001-browse.md`, `${SPECS}/VAL-001-check.md`],
  );
});

test('adjacentSpecs skips interactions without a document', () => {
  const rows = interactionRows(fixture());
  assert.equal(adjacentSpecs(rows, 'VAL-001-check').next?.id, 'DSH-001-browse');
  assert.equal(adjacentSpecs(rows, 'DSH-001-browse').next, null);
  assert.deepEqual(adjacentSpecs(rows, 'DSH-001-idea'), { previous: null, next: null });
});

test('filterRows combines facets, document presence, findings and text', () => {
  const rows = interactionRows(fixture());
  const ids = (filter: Partial<typeof EMPTY_FILTER>) =>
    filterRows(rows, { ...EMPTY_FILTER, ...filter }).map((r) => r.id);
  assert.equal(ids({}).length, 3);
  assert.deepEqual(ids({ categories: ['DSH'] }), ['DSH-001-browse', 'DSH-001-idea']);
  assert.deepEqual(ids({ lifecycles: ['idea'] }), ['DSH-001-idea']);
  assert.deepEqual(ids({ document: 'without' }), ['DSH-001-idea']);
  assert.deepEqual(ids({ findingsOnly: true }), ['DSH-001-browse']);
  assert.deepEqual(ids({ query: 'summary check' }), ['VAL-001-check']);
  assert.deepEqual(
    facet(rows, (r) => r.lifecycle),
    [
      { value: 'implementing', count: 2 },
      { value: 'idea', count: 1 },
    ],
  );
});

test('search matches acceptance criteria and ranks ID matches first', () => {
  const result = fixture();
  const entries = searchEntries(interactionRows(result), result, LOCAL);
  assert.deepEqual(
    searchMatches(entries, 'criterion 2').map((e) => e.id),
    ['VAL-001-check'],
  );
  assert.equal(searchMatches(entries, 'dsh-001-idea')[0]?.id, 'DSH-001-idea');
  assert.equal(searchMatches(entries, 'browse flow')[0]?.kind, 'document');
  assert.deepEqual(searchMatches(entries, 'nothing matches this'), []);
});

test('outline lists second-level headings with their anchors', () => {
  const { blocks } = markdownView('# T\n\n## Intent\n\n### Detail\n\n## Trigger / Entry Points\n');
  assert.deepEqual(outline(blocks), [
    { slug: 'intent', text: 'Intent' },
    { slug: 'trigger--entry-points', text: 'Trigger / Entry Points' },
  ]);
});
