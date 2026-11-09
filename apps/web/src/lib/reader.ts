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

export function categoryHref(routes: ReaderRoutes, key: string): string {
  return `${routes.base}/categories/${encodeURIComponent(key)}${routes.query}`;
}

export function featureHref(routes: ReaderRoutes, id: string): string {
  return `${routes.base}/features/${encodeURIComponent(id)}${routes.query}`;
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
interface DeclaredCategory {
  title: string;
  description: string;
  order: number;
}
interface DeclaredFeature {
  title: string;
  description: string;
  categoryKey: string;
  relatedUi: string;
}

/** Categories and features as the inventory declares them. */
function declared(result: CheckResult) {
  const categories = new Map<string, DeclaredCategory>();
  for (const [index, row] of inventory(result, 'categories').entries()) {
    const key = clean(row.values.category_key);
    if (!key || categories.has(key)) continue;
    const order = Number(row.values.order);
    categories.set(key, {
      title: clean(row.values.category_title) || key,
      description: clean(row.values.description),
      order: Number.isFinite(order) ? order : index,
    });
  }
  const features = new Map<string, DeclaredFeature>();
  for (const row of inventory(result, 'features')) {
    const id = clean(row.values.feature_id);
    if (!id || features.has(id)) continue;
    features.set(id, {
      title: clean(row.values.feature_title) || id,
      description: clean(row.values.description),
      categoryKey: clean(row.values.category_key),
      relatedUi: clean(row.values.related_ui),
    });
  }
  const order = (key: string) => categories.get(key)?.order ?? Number.MAX_SAFE_INTEGER;
  return { categories, features, order };
}

export function interactionRows(result: CheckResult): InteractionRow[] {
  const { categories, features, order } = declared(result);
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
      featureTitle: features.get(featureId)?.title || clean(values.feature) || featureId,
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

  return [...rows.values()].sort(
    (a, b) =>
      order(a.categoryKey) - order(b.categoryKey) ||
      a.categoryKey.localeCompare(b.categoryKey) ||
      a.id.localeCompare(b.id),
  );
}

/** A feature from the inventory with the interactions that belong to it. */
export interface FeatureRow {
  id: string;
  title: string;
  description: string;
  categoryKey: string;
  categoryTitle: string;
  relatedUi: string;
  /** false when interactions reference the feature but the inventory does not declare it. */
  declared: boolean;
  interactions: InteractionRow[];
}

/** A category from the inventory with its features, in inventory order. */
export interface CategoryRow {
  key: string;
  title: string;
  description: string;
  declared: boolean;
  features: FeatureRow[];
  interactions: InteractionRow[];
}

/**
 * Categories and features with their descriptions and interactions. Declared entries without
 * interactions are kept; categories and features that interactions reference without a
 * declaration are added as undeclared so nothing disappears from the reader.
 */
export function catalog(result: CheckResult, rows: InteractionRow[]): CategoryRow[] {
  const known = declared(result);
  const features = new Map<string, FeatureRow>();
  for (const [id, f] of known.features)
    features.set(id, {
      id,
      title: f.title,
      description: f.description,
      categoryKey: f.categoryKey,
      categoryTitle: known.categories.get(f.categoryKey)?.title ?? f.categoryKey,
      relatedUi: f.relatedUi,
      declared: true,
      interactions: [],
    });
  for (const row of rows) {
    let feature = features.get(row.featureId);
    if (!feature) {
      feature = {
        id: row.featureId,
        title: row.featureTitle || row.featureId || 'No feature',
        description: '',
        categoryKey: row.categoryKey,
        categoryTitle: row.categoryTitle,
        relatedUi: '',
        declared: false,
        interactions: [],
      };
      features.set(row.featureId, feature);
    }
    feature.interactions.push(row);
  }

  const categories = new Map<string, CategoryRow>();
  for (const [key, c] of known.categories)
    categories.set(key, {
      key,
      title: c.title,
      description: c.description,
      declared: true,
      features: [],
      interactions: [],
    });
  for (const feature of [...features.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    let category = categories.get(feature.categoryKey);
    if (!category) {
      category = {
        key: feature.categoryKey,
        title: feature.categoryTitle || feature.categoryKey,
        description: '',
        declared: false,
        features: [],
        interactions: [],
      };
      categories.set(feature.categoryKey, category);
    }
    category.features.push(feature);
    category.interactions.push(...feature.interactions);
  }
  return [...categories.values()].sort(
    (a, b) => known.order(a.key) - known.order(b.key) || a.key.localeCompare(b.key),
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
  href: string;
  interactions: TreeInteraction[];
}
export interface TreeCategory {
  key: string;
  title: string;
  href: string;
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
  categories: CategoryRow[],
  documents: Pick<RepositoryDocument, 'kind' | 'path' | 'title'>[],
  routes: ReaderRoutes,
): ReaderTree {
  const tree: TreeCategory[] = categories.map((category) => ({
    key: category.key,
    title: category.title,
    href: categoryHref(routes, category.key),
    features: category.features.map((feature) => ({
      id: feature.id,
      title: feature.title,
      href: featureHref(routes, feature.id),
      interactions: feature.interactions.map((row) => ({
        id: row.id,
        title: row.title,
        lifecycle: row.lifecycle,
        href: specHref(routes, row.id),
        hasSpec: row.spec !== null,
        errors: row.errors,
      })),
    })),
  }));
  const groups = GROUPS.map(({ label, kinds }) => ({
    label,
    documents: documents
      .filter((d) => kinds.includes(d.kind))
      .map((d) => ({ path: d.path, title: d.title, href: documentHref(routes, d.path) }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  })).filter((g) => g.documents.length > 0);
  return { categories: tree, groups };
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

/**
 * Search entries for the command palette: interaction IDs, titles, summaries and acceptance
 * criteria, categories and features with their descriptions, and document titles and paths.
 */
export function searchEntries(
  rows: InteractionRow[],
  result: CheckResult,
  routes: ReaderRoutes,
  categories: CategoryRow[] = [],
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
  for (const category of categories) {
    entries.push({
      kind: 'category',
      id: category.key,
      title: category.title,
      path: null,
      href: categoryHref(routes, category.key),
      detail: category.description || `${category.features.length} features`,
      text: [category.key, category.title, category.description].join(' ').toLowerCase(),
    });
    for (const feature of category.features)
      entries.push({
        kind: 'feature',
        id: feature.id,
        title: feature.title,
        path: null,
        href: featureHref(routes, feature.id),
        detail: feature.description || category.title,
        text: [feature.id, feature.title, feature.description, category.title]
          .join(' ')
          .toLowerCase(),
      });
  }
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
