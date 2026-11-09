import { posix } from 'node:path';
import type {
  CheckResult,
  DocumentKind,
  Finding,
  Inventory,
  RepositoryDocument,
  Spec,
} from '@spectrum/core';
import type { MarkdownBlock } from '@spectrum/spec-engine/markdown';
import type { InteractionRow, SearchEntry } from './reader-query.ts';

export type { InteractionRow, RowFilter, SearchEntry } from './reader-query.ts';
export { EMPTY_FILTER, facet, filterRows, searchMatches } from './reader-query.ts';

/**
 * Where the spec reader lives and how a repository path becomes a source link. The local reader
 * uses `/specs` with no source links; a connected repository uses its own base, keeps the
 * revision query and links paths to GitHub at the pinned commit.
 */
export interface ReaderRoutes {
  base: string;
  query: string;
  source?: (path: string, line?: number) => string;
}

/** Routes for a connected repository: links source paths to GitHub at the pinned commit. */
export function remoteRoutes(
  base: string,
  query: string,
  htmlUrl: string,
  sha: string,
): ReaderRoutes {
  return {
    base,
    query,
    source: (path, line) =>
      `${htmlUrl}/blob/${sha}/${path.split('/').map(encodeURIComponent).join('/')}${line ? `#L${line}` : ''}`,
  };
}

export function specHref(routes: ReaderRoutes, id: string): string {
  return `${routes.base}/${encodeURIComponent(id)}${routes.query}`;
}

export function documentHref(routes: ReaderRoutes, path: string): string {
  return `${routes.base}/documents/${path.split('/').map(encodeURIComponent).join('/')}${routes.query}`;
}

function inventory(result: CheckResult, kind: Inventory['kind']): Inventory['rows'] {
  return result.model.inventories.filter((i) => i.kind === kind).flatMap((i) => i.rows);
}

function clean(value: string | undefined): string {
  const v = value?.trim() ?? '';
  return v === '-' ? '' : v;
}

function findingCounts(findings: Finding[], path: string | undefined) {
  let errors = 0;
  let warnings = 0;
  if (path)
    for (const f of findings)
      if (f.path === path) {
        if (f.severity === 'error') errors++;
        else warnings++;
      }
  return { errors, warnings };
}

/**
 * Every interaction the repository declares, in category order then by ID. Interactions that
 * only exist in the inventory are kept so planned work stays visible; specs without an inventory
 * row (a structural finding elsewhere) are kept too.
 */
export function interactionRows(result: CheckResult): InteractionRow[] {
  const categories = new Map<string, { title: string; order: number }>();
  for (const [index, row] of inventory(result, 'categories').entries()) {
    const key = clean(row.values.category_key);
    if (!key) continue;
    const order = Number(row.values.order);
    categories.set(key, {
      title: clean(row.values.category_title) || key,
      order: Number.isFinite(order) ? order : index,
    });
  }
  const features = new Map<string, string>();
  for (const row of inventory(result, 'features')) {
    const id = clean(row.values.feature_id);
    if (id) features.set(id, clean(row.values.feature_title) || id);
  }
  const specs = new Map(result.specs.map((s) => [s.id, s]));
  const rows = new Map<string, InteractionRow>();

  const make = (id: string, values: Record<string, string>, spec: Spec | undefined) => {
    const categoryKey = clean(values.category_key) || spec?.categoryKey || '';
    const featureId = clean(values.feature_id) || spec?.featureId || '';
    return {
      id,
      title: clean(values.interaction_title) || spec?.title || id,
      summary: clean(values.summary),
      categoryKey,
      categoryTitle: categories.get(categoryKey)?.title ?? categoryKey,
      featureId,
      featureTitle: features.get(featureId) ?? clean(values.feature) ?? featureId,
      type: clean(values.interaction_type),
      lifecycle: clean(values.status) || spec?.implementationStatus || '',
      phase: clean(values.phase) || spec?.phase || '',
      region: clean(values.related_region),
      spec: spec
        ? { path: spec.path, documentStatus: spec.status, acceptance: spec.acceptance.length }
        : null,
      ...findingCounts(result.findings, spec?.path),
    } satisfies InteractionRow;
  };

  for (const row of inventory(result, 'interactions')) {
    const id = clean(row.values.interaction_id);
    if (id && !rows.has(id)) rows.set(id, make(id, row.values, specs.get(id)));
  }
  for (const spec of result.specs)
    if (!rows.has(spec.id)) rows.set(spec.id, make(spec.id, {}, spec));

  const order = (key: string) => categories.get(key)?.order ?? Number.MAX_SAFE_INTEGER;
  return [...rows.values()].sort(
    (a, b) =>
      order(a.categoryKey) - order(b.categoryKey) ||
      a.categoryKey.localeCompare(b.categoryKey) ||
      a.id.localeCompare(b.id),
  );
}

export interface TreeInteraction {
  id: string;
  title: string;
  lifecycle: string;
  href: string;
  hasSpec: boolean;
  errors: number;
}
export interface TreeFeature {
  id: string;
  title: string;
  interactions: TreeInteraction[];
}
export interface TreeCategory {
  key: string;
  title: string;
  features: TreeFeature[];
}
export interface TreeDocument {
  path: string;
  title: string;
  href: string;
}
export interface TreeGroup {
  label: string;
  documents: TreeDocument[];
}
export interface ReaderTree {
  categories: TreeCategory[];
  groups: TreeGroup[];
}

const GROUPS: { label: string; kinds: DocumentKind[] }[] = [
  { label: 'Overview', kinds: ['overview'] },
  { label: 'Flows', kinds: ['flow'] },
  { label: 'Contracts', kinds: ['contract'] },
  {
    label: 'Pages',
    kinds: ['page_contract', 'surface_contract', 'layout', 'page_spec', 'surface_spec'],
  },
  { label: 'Engineering', kinds: ['engineering'] },
  { label: 'Rules', kinds: ['rule'] },
  { label: 'Reference', kinds: ['reference'] },
];

/** Navigation tree: Category → Feature → Interaction, then the other documents by kind. */
export function readerTree(
  rows: InteractionRow[],
  documents: Pick<RepositoryDocument, 'kind' | 'path' | 'title'>[],
  routes: ReaderRoutes,
): ReaderTree {
  const categories: TreeCategory[] = [];
  for (const row of rows) {
    let category = categories.find((c) => c.key === row.categoryKey);
    if (!category) {
      category = { key: row.categoryKey, title: row.categoryTitle, features: [] };
      categories.push(category);
    }
    let feature = category.features.find((f) => f.id === row.featureId);
    if (!feature) {
      feature = { id: row.featureId, title: row.featureTitle, interactions: [] };
      category.features.push(feature);
    }
    feature.interactions.push({
      id: row.id,
      title: row.title,
      lifecycle: row.lifecycle,
      href: specHref(routes, row.id),
      hasSpec: row.spec !== null,
      errors: row.errors,
    });
  }
  for (const category of categories) category.features.sort((a, b) => a.id.localeCompare(b.id));
  const groups = GROUPS.map(({ label, kinds }) => ({
    label,
    documents: documents
      .filter((d) => kinds.includes(d.kind))
      .map((d) => ({ path: d.path, title: d.title, href: documentHref(routes, d.path) }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  })).filter((g) => g.documents.length > 0);
  return { categories, groups };
}

export type ResolvedLink =
  | { kind: 'internal'; href: string }
  | { kind: 'external'; href: string }
  | { kind: 'none' };

export interface LinkContext {
  routes: ReaderRoutes;
  /** Spec ID by repository path. */
  specs: Map<string, string>;
  documents: Set<string>;
}

export function linkContext(result: CheckResult, routes: ReaderRoutes): LinkContext {
  return {
    routes,
    specs: new Map(result.specs.map((s) => [s.path, s.id])),
    documents: new Set(result.model.documents.map((d) => d.path)),
  };
}

/** Resolve a repository path to the reader page that shows it, or to its source. */
export function pathLink(path: string, context: LinkContext, fragment = ''): ResolvedLink {
  const hash = fragment ? `#${fragment}` : '';
  const spec = context.specs.get(path);
  if (spec) return { kind: 'internal', href: `${specHref(context.routes, spec)}${hash}` };
  if (context.documents.has(path))
    return { kind: 'internal', href: `${documentHref(context.routes, path)}${hash}` };
  if (context.routes.source) return { kind: 'external', href: context.routes.source(path) };
  return { kind: 'none' };
}

/**
 * Resolve a link written in a document. Relative links resolve against the document's directory
 * the same way the structural check does; paths outside the repository are not linked.
 */
export function resolveLink(from: string, href: string, context: LinkContext): ResolvedLink {
  if (href.startsWith('#')) return { kind: 'internal', href };
  if (/^(https?:|mailto:)/i.test(href)) return { kind: 'external', href };
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return { kind: 'none' };
  const [rawPath = '', fragment = ''] = href.split('#', 2);
  if (!rawPath) return { kind: 'none' };
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return { kind: 'none' };
  }
  const path = posix.normalize(
    decoded.startsWith('/') ? decoded.slice(1) : posix.join(posix.dirname(from), decoded),
  );
  if (path.startsWith('..') || posix.isAbsolute(path)) return { kind: 'none' };
  return pathLink(path, context, fragment);
}

export interface OutlineEntry {
  slug: string;
  text: string;
}

/** Second-level headings, the sections a reader jumps between. */
export function outline(blocks: MarkdownBlock[]): OutlineEntry[] {
  return blocks.flatMap((b) =>
    b.type === 'heading' && b.depth === 2 ? [{ slug: b.slug, text: b.text }] : [],
  );
}

export interface RelatedDocument {
  path: string;
  title: string;
  link: ResolvedLink;
}

/** Documents this path links to and documents that link to it, from the resolved model. */
export function relatedDocuments(
  path: string,
  result: CheckResult,
  context: LinkContext,
): { linksTo: RelatedDocument[]; linkedFrom: RelatedDocument[] } {
  const titles = new Map(result.model.documents.map((d) => [d.path, d.title]));
  const related = (p: string) => ({
    path: p,
    title: titles.get(p) ?? p,
    link: pathLink(p, context),
  });
  const links = result.model.relationships.filter((r) => r.kind === 'document_link');
  const unique = (paths: string[]) => [...new Set(paths)].filter((p) => p !== path).sort();
  return {
    linksTo: unique(links.filter((r) => r.source === path).map((r) => r.target)).map(related),
    linkedFrom: unique(links.filter((r) => r.target === path).map((r) => r.source)).map(related),
  };
}

/** Neighbors in reading order, among interactions that have a spec document. */
export function adjacentSpecs(
  rows: InteractionRow[],
  id: string,
): { previous: InteractionRow | null; next: InteractionRow | null } {
  const readable = rows.filter((r) => r.spec !== null);
  const index = readable.findIndex((r) => r.id === id);
  if (index < 0) return { previous: null, next: null };
  return { previous: readable[index - 1] ?? null, next: readable[index + 1] ?? null };
}

/** Search entries for the command palette: IDs, titles, summaries and acceptance criteria. */
export function searchEntries(
  rows: InteractionRow[],
  result: CheckResult,
  routes: ReaderRoutes,
): SearchEntry[] {
  const specs = new Map(result.specs.map((s) => [s.id, s]));
  const entries: SearchEntry[] = rows.map((row) => {
    const spec = specs.get(row.id);
    const acceptance = spec?.acceptance.map((a) => a.statement).join(' ') ?? '';
    return {
      kind: 'interaction',
      id: row.id,
      title: row.title,
      path: row.spec?.path ?? null,
      href: specHref(routes, row.id),
      detail: row.summary || row.featureTitle,
      text: [row.id, row.title, row.summary, row.featureTitle, row.categoryTitle, acceptance]
        .join(' ')
        .toLowerCase(),
    };
  });
  for (const doc of result.model.documents) {
    if (doc.kind === 'interaction') continue;
    entries.push({
      kind: 'document',
      id: null,
      title: doc.title,
      path: doc.path,
      href: documentHref(routes, doc.path),
      detail: doc.path,
      text: `${doc.title} ${doc.path}`.toLowerCase(),
    });
  }
  return entries;
}
