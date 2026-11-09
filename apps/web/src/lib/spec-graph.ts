import type { CheckResult, DocumentKind } from '@spectrum/core';
import {
  type CategoryRow,
  categoryHref,
  documentHref,
  featureHref,
  type InteractionRow,
  type ReaderRoutes,
  specHref,
} from './reader.ts';

/**
 * Node groups as the graph legend and filters name them. Interaction specs, their features and
 * categories come from the inventory; the other groups are the loaded documents by kind.
 */
export type GraphGroup =
  | 'interaction'
  | 'feature'
  | 'category'
  | 'contract'
  | 'flow'
  | 'page'
  | 'engineering'
  | 'rule'
  | 'reference'
  | 'overview';

export const GRAPH_GROUPS: { group: GraphGroup; label: string }[] = [
  { group: 'interaction', label: 'Interactions' },
  { group: 'feature', label: 'Features' },
  { group: 'category', label: 'Categories' },
  { group: 'contract', label: 'Contracts' },
  { group: 'flow', label: 'Flows' },
  { group: 'page', label: 'Pages' },
  { group: 'engineering', label: 'Engineering' },
  { group: 'rule', label: 'Rules' },
  { group: 'reference', label: 'Reference' },
  { group: 'overview', label: 'Overview' },
];

const DOCUMENT_GROUP: Record<Exclude<DocumentKind, 'interaction'>, GraphGroup> = {
  contract: 'contract',
  flow: 'flow',
  page_contract: 'page',
  surface_contract: 'page',
  layout: 'page',
  page_spec: 'page',
  surface_spec: 'page',
  engineering: 'engineering',
  rule: 'rule',
  reference: 'reference',
  overview: 'overview',
};

/**
 * How two nodes relate: a link written in a document, a contract that owns an interaction, an
 * interaction whose region a surface contract covers, or inventory membership (interaction to
 * feature, feature to category).
 */
export type GraphEdgeKind = 'link' | 'ownership' | 'region' | 'membership';

export interface GraphNode {
  id: string;
  /** Short label drawn next to the node: the interaction or feature ID, or a document title. */
  label: string;
  title: string;
  group: GraphGroup;
  href: string;
  /** Repository path of the node's document; null for features, categories and interactions without one. */
  path: string | null;
  /** false for an interaction the inventory declares without a spec document. */
  hasDocument: boolean;
  /** Structural error findings on the node's document. */
  errors: number;
  degree: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: GraphEdgeKind;
}

export interface SpecGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const interactionNode = (id: string) => `interaction:${id}`;
const featureNode = (id: string) => `feature:${id}`;
const categoryNode = (key: string) => `category:${key}`;
const documentNode = (path: string) => `document:${path}`;

/**
 * The specification graph of one check result. Every interaction, feature, category and loaded
 * document is a node; edges come only from the resolved model and the inventory, never from
 * inferred similarity. An interaction's spec document is the interaction node itself, so links to
 * and from that file attach to it. Edges are undirected and deduplicated, and an edge whose end
 * is not a node (an unresolved link) is left out.
 */
export function specGraph(
  result: CheckResult,
  rows: InteractionRow[],
  categories: CategoryRow[],
  routes: ReaderRoutes,
): SpecGraph {
  const nodes = new Map<string, GraphNode>();
  const byPath = new Map<string, string>();
  const errors = new Map<string, number>();
  for (const f of result.findings)
    if (f.severity === 'error') errors.set(f.path, (errors.get(f.path) ?? 0) + 1);

  const add = (node: Omit<GraphNode, 'degree'>) => {
    if (!nodes.has(node.id)) nodes.set(node.id, { ...node, degree: 0 });
    if (node.path) byPath.set(node.path, node.id);
  };

  for (const category of categories) {
    if (!category.key) continue;
    add({
      id: categoryNode(category.key),
      label: category.title,
      title: category.title,
      group: 'category',
      href: categoryHref(routes, category.key),
      path: null,
      hasDocument: true,
      errors: 0,
    });
    for (const feature of category.features) {
      if (!feature.id) continue;
      add({
        id: featureNode(feature.id),
        label: feature.id,
        title: feature.title,
        group: 'feature',
        href: featureHref(routes, feature.id),
        path: null,
        hasDocument: true,
        errors: 0,
      });
    }
  }
  for (const row of rows)
    add({
      id: interactionNode(row.id),
      label: row.id,
      title: row.title,
      group: 'interaction',
      href: specHref(routes, row.id),
      path: row.spec?.path ?? null,
      hasDocument: row.spec !== null,
      errors: row.errors,
    });
  for (const doc of result.model.documents) {
    if (doc.kind === 'interaction') {
      // A spec document without an interaction row is still reachable through its path.
      if (!byPath.has(doc.path)) {
        const spec = result.specs.find((s) => s.path === doc.path);
        if (spec) byPath.set(doc.path, interactionNode(spec.id));
      }
      continue;
    }
    add({
      id: documentNode(doc.path),
      label: doc.title || doc.path,
      title: doc.title || doc.path,
      group: DOCUMENT_GROUP[doc.kind],
      href: documentHref(routes, doc.path),
      path: doc.path,
      hasDocument: true,
      errors: errors.get(doc.path) ?? 0,
    });
  }

  const edges = new Map<string, GraphEdge>();
  const connect = (a: string | undefined, b: string | undefined, kind: GraphEdgeKind) => {
    if (!a || !b || a === b || !nodes.has(a) || !nodes.has(b)) return;
    const key = a < b ? `${a}\n${b}` : `${b}\n${a}`;
    if (edges.has(key)) return;
    edges.set(key, { source: a, target: b, kind });
  };

  for (const row of rows) {
    connect(interactionNode(row.id), featureNode(row.featureId), 'membership');
  }
  for (const category of categories)
    for (const feature of category.features)
      connect(featureNode(feature.id), categoryNode(category.key), 'membership');

  const regions = new Map<string, string[]>();
  for (const row of rows)
    if (row.region) regions.set(row.region, [...(regions.get(row.region) ?? []), row.id]);

  for (const r of result.model.relationships) {
    if (r.kind === 'document_link') connect(byPath.get(r.source), byPath.get(r.target), 'link');
    else if (r.kind === 'ownership')
      connect(byPath.get(r.source), interactionNode(r.target), 'ownership');
    else if (r.kind === 'region_contract')
      for (const id of regions.get(r.source) ?? [])
        connect(interactionNode(id), byPath.get(r.target), 'region');
  }

  for (const edge of edges.values()) {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (source) source.degree++;
    if (target) target.degree++;
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
