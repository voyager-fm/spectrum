import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CheckResult, Inventory, RepositoryDocument, Spec } from '@spectrum/core';
import { bounds, ForceLayout, fitView } from './graph-layout.ts';
import { catalog, interactionRows, type ReaderRoutes } from './reader.ts';
import { specGraph } from './spec-graph.ts';

const SPECS = '.spectrum/specs';
const CONTRACT = '.spectrum/contracts/dashboard.toml';
const FLOW = '.spectrum/flows/browse.md';
const SURFACE = '.spectrum/surfaces/web/specs/contract.toml';
const ROUTES: ReaderRoutes = { base: '/repositories/acme/app/specs', query: '?ref=main' };

function table(kind: Inventory['kind'], rows: Record<string, string>[]): Inventory {
  return {
    kind,
    path: `${kind}.tsv`,
    schemaPath: 'schema.json',
    schema: { schema_version: '2', name: kind, primary_key: [], columns: [] },
    rows: rows.map((values, i) => ({ line: i + 2, values })),
  };
}

function spec(id: string, feature: string, category: string): Spec {
  return {
    id,
    featureId: feature,
    categoryKey: category,
    title: `Title ${id}`,
    status: 'draft',
    implementationStatus: 'implementing',
    phase: 'now',
    path: `${SPECS}/${id}.md`,
    body: '',
    acceptance: [],
    links: [],
  };
}

function doc(kind: RepositoryDocument['kind'], path: string, title: string): RepositoryDocument {
  return { kind, path, title, body: '', metadata: {}, links: [] };
}

function fixture(): CheckResult {
  const specs = [
    spec('DSH-001-browse', 'DSH-001', 'DSH'),
    spec('DSH-001-search', 'DSH-001', 'DSH'),
  ];
  return {
    ok: false,
    findings: [
      { code: 'broken-link', message: 'Missing', path: FLOW, severity: 'error' },
      { code: 'stale', message: 'Old', path: FLOW, severity: 'warning' },
    ],
    specs,
    config: null,
    model: {
      inventories: [
        table('categories', [{ order: '1', category_key: 'DSH', category_title: 'Dashboard' }]),
        table('features', [
          { feature_id: 'DSH-001', feature_title: 'Browsing', category_key: 'DSH' },
        ]),
        table('interactions', [
          {
            interaction_id: 'DSH-001-browse',
            interaction_title: 'Browse',
            category_key: 'DSH',
            feature_id: 'DSH-001',
            related_region: 'web.specs',
          },
          {
            interaction_id: 'DSH-001-search',
            interaction_title: 'Search',
            category_key: 'DSH',
            feature_id: 'DSH-001',
            related_region: 'web.search',
          },
          {
            interaction_id: 'DSH-001-planned',
            interaction_title: 'Planned',
            category_key: 'DSH',
            feature_id: 'DSH-001',
            related_region: 'web.specs',
          },
        ]),
      ],
      documents: [
        ...specs.map((s) => doc('interaction', s.path, s.title)),
        doc('contract', CONTRACT, 'Dashboard contract'),
        doc('flow', FLOW, 'Browse flow'),
        doc('surface_contract', SURFACE, 'Specs surface'),
      ],
      relationships: [
        { kind: 'document_link', source: `${SPECS}/DSH-001-browse.md`, target: FLOW },
        // The same link written twice and in the other direction is one edge.
        { kind: 'document_link', source: FLOW, target: `${SPECS}/DSH-001-browse.md` },
        { kind: 'document_link', source: `${SPECS}/DSH-001-browse.md`, target: FLOW },
        { kind: 'document_link', source: FLOW, target: '.spectrum/missing.md' },
        { kind: 'document_link', source: FLOW, target: FLOW },
        { kind: 'ownership', source: CONTRACT, target: 'DSH-001-search' },
        { kind: 'region_contract', source: 'web.specs', target: SURFACE },
        { kind: 'specification', source: 'DSH-001-browse', target: `${SPECS}/DSH-001-browse.md` },
        { kind: 'reference', source: 'A:["x"]', target: 'B:["y"]' },
      ],
    },
  };
}

function build(result = fixture()) {
  const rows = interactionRows(result);
  return specGraph(result, rows, catalog(result, rows), ROUTES);
}

const key = (a: string, b: string) => [a, b].sort().join(' — ');

test('every interaction, feature, category and non-interaction document is one node', () => {
  const graph = build();
  assert.deepEqual(graph.nodes.map((n) => n.id).sort(), [
    'category:DSH',
    `document:${CONTRACT}`,
    `document:${FLOW}`,
    `document:${SURFACE}`,
    'feature:DSH-001',
    'interaction:DSH-001-browse',
    'interaction:DSH-001-planned',
    'interaction:DSH-001-search',
  ]);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  assert.equal(byId.get(`document:${SURFACE}`)?.group, 'page');
  assert.equal(byId.get('interaction:DSH-001-planned')?.hasDocument, false);
  assert.equal(byId.get('interaction:DSH-001-browse')?.path, `${SPECS}/DSH-001-browse.md`);
  // Only error findings count, so a warning does not mark the node.
  assert.equal(byId.get(`document:${FLOW}`)?.errors, 1);
  assert.equal(
    byId.get('interaction:DSH-001-browse')?.href,
    '/repositories/acme/app/specs/DSH-001-browse?ref=main',
  );
  assert.equal(
    byId.get(`document:${FLOW}`)?.href,
    '/repositories/acme/app/specs/documents/.spectrum/flows/browse.md?ref=main',
  );
  assert.equal(
    byId.get('feature:DSH-001')?.href,
    '/repositories/acme/app/specs/features/DSH-001?ref=main',
  );
});

test('edges come from links, ownership, regions and membership, deduplicated and resolved', () => {
  const graph = build();
  const edges = new Map(graph.edges.map((e) => [key(e.source, e.target), e.kind]));
  assert.deepEqual(
    [...edges.entries()].sort(),
    [
      [key('feature:DSH-001', 'category:DSH'), 'membership'],
      [key('interaction:DSH-001-browse', 'feature:DSH-001'), 'membership'],
      [key('interaction:DSH-001-planned', 'feature:DSH-001'), 'membership'],
      [key('interaction:DSH-001-search', 'feature:DSH-001'), 'membership'],
      [key('interaction:DSH-001-browse', `document:${FLOW}`), 'link'],
      [key(`document:${CONTRACT}`, 'interaction:DSH-001-search'), 'ownership'],
      [key('interaction:DSH-001-browse', `document:${SURFACE}`), 'region'],
      [key('interaction:DSH-001-planned', `document:${SURFACE}`), 'region'],
    ].sort(),
  );
  assert.equal(graph.edges.length, edges.size);
  const degree = new Map(graph.nodes.map((n) => [n.id, n.degree]));
  assert.equal(degree.get('interaction:DSH-001-browse'), 3);
  assert.equal(degree.get('feature:DSH-001'), 4);
});

test('an empty repository has an empty graph', () => {
  const graph = build({
    ok: true,
    findings: [],
    specs: [],
    config: null,
    model: { inventories: [], documents: [], relationships: [] },
  });
  assert.deepEqual(graph, { nodes: [], edges: [] });
});

test('the layout is deterministic, finite and pulls linked nodes together', () => {
  // Two triangles joined by nothing: within-triangle distances end up shorter than across.
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 0],
    [3, 4],
    [4, 5],
    [5, 3],
  ];
  const a = new ForceLayout(6, edges);
  const b = new ForceLayout(6, edges);
  const ticks = a.run();
  b.run();
  assert.ok(ticks > 0 && a.settled);
  assert.deepEqual(a.points, b.points);
  for (const p of a.points) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  const d = (i: number, j: number) =>
    Math.hypot(a.points[i].x - a.points[j].x, a.points[i].y - a.points[j].y);
  const within = (d(0, 1) + d(1, 2) + d(3, 4)) / 3;
  const across = (d(0, 3) + d(1, 4) + d(2, 5)) / 3;
  assert.ok(within < across, `within ${within} should be below across ${across}`);
});

test('a pinned node stays where it is dragged, and invalid edges are ignored', () => {
  const layout = new ForceLayout(3, [
    [0, 1],
    [1, 1],
    [0, 9],
  ]);
  layout.points[0].fx = 100;
  layout.points[0].fy = -50;
  layout.run();
  assert.equal(layout.points[0].x, 100);
  assert.equal(layout.points[0].y, -50);
  layout.reheat(0.4);
  assert.equal(layout.alpha, 0.4);
  assert.equal(layout.run(0), 0);
});

test('fitView centres the bounds in the viewport', () => {
  const b = bounds([
    { x: -100, y: -50 },
    { x: 100, y: 50 },
  ]);
  assert.deepEqual(b, { minX: -100, minY: -50, maxX: 100, maxY: 50 });
  const view = fitView(b, 440, 300, 20);
  assert.equal(view.scale, 2);
  assert.equal(view.x, 220);
  assert.equal(view.y, 150);
  const wide = fitView(b, 240, 600, 20);
  assert.equal(wide.scale, 1);
  assert.deepEqual(bounds([]), { minX: 0, minY: 0, maxX: 0, maxY: 0 });
});
