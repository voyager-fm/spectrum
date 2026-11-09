import type { Finding, RepositoryModel, Spec } from '@spectrum/core';

/**
 * Aggregations behind the overview charts. Every figure is derived from one shared engine result
 * or from stored check rows; nothing here is sampled, estimated or model-generated.
 */

export interface Part {
  value: string;
  count: number;
}

/** Known values in reading order. Values a repository uses outside them follow, by count. */
const REVIEW_ORDER = ['draft', 'in_review', 'changes_requested', 'approved', 'untracked'];
const LIFECYCLE_ORDER = ['idea', 'drafted', 'planned', 'implementing', 'shipped', 'deprecated'];
const PHASE_ORDER = ['now', 'next', 'later'];

const UNSET = 'unset';

function distribute(values: string[], order: string[]): Part[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v.trim() || UNSET;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const known = order.filter((v) => counts.has(v));
  const rest = [...counts.keys()]
    .filter((v) => !order.includes(v))
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));
  return [...known, ...rest].map((value) => ({ value, count: counts.get(value) ?? 0 }));
}

export interface StatusDistribution {
  total: number;
  review: Part[];
  lifecycle: Part[];
  phase: Part[];
}

/** Document review, declared lifecycle and phase stay three separate distributions. */
export function statusDistribution(specs: Spec[]): StatusDistribution {
  return {
    total: specs.length,
    review: distribute(
      specs.map((s) => s.status),
      REVIEW_ORDER,
    ),
    lifecycle: distribute(
      specs.map((s) => s.implementationStatus),
      LIFECYCLE_ORDER,
    ),
    phase: distribute(
      specs.map((s) => s.phase),
      PHASE_ORDER,
    ),
  };
}

/** Category keys in the repository's FI categories table order, when it declares one. */
export function categoryOrder(model: Pick<RepositoryModel, 'inventories'>): string[] {
  const rows = model.inventories
    .filter((inv) => inv.kind === 'categories')
    .flatMap((inv) => inv.rows.map((r) => r.values));
  const ranked = rows
    .map((values, i) => ({
      key: values.category_key?.trim() ?? '',
      rank: Number.isFinite(Number(values.order)) && values.order ? Number(values.order) : i,
    }))
    .filter((r) => r.key);
  return [...new Set(ranked.sort((a, b) => a.rank - b.rank).map((r) => r.key))];
}

export interface CategoryRow {
  categoryKey: string;
  specs: number;
  lifecycle: Part[];
  acceptance: number;
  findings: number;
}

/**
 * Per-category counts. `order` is the repository's own category order (for example the FI
 * categories table); keys it does not list follow alphabetically.
 */
export function categoryBreakdown(
  specs: Spec[],
  findings: Finding[],
  order: string[] = [],
): CategoryRow[] {
  const byPath = new Map(specs.map((s) => [s.path, s]));
  const groups = new Map<string, Spec[]>();
  for (const s of specs) {
    const key = s.categoryKey.trim() || UNSET;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const findingCounts = new Map<string, number>();
  for (const f of findings) {
    const spec = byPath.get(f.path);
    if (!spec) continue;
    const key = spec.categoryKey.trim() || UNSET;
    findingCounts.set(key, (findingCounts.get(key) ?? 0) + 1);
  }
  const keys = [
    ...order.filter((k) => groups.has(k)),
    ...[...groups.keys()].filter((k) => !order.includes(k)).sort(),
  ];
  return keys.map((categoryKey) => {
    const members = groups.get(categoryKey) ?? [];
    return {
      categoryKey,
      specs: members.length,
      lifecycle: distribute(
        members.map((s) => s.implementationStatus),
        LIFECYCLE_ORDER,
      ),
      acceptance: members.reduce((n, s) => n + s.acceptance.length, 0),
      findings: findingCounts.get(categoryKey) ?? 0,
    };
  });
}

export interface AcceptanceCoverage {
  total: number;
  withId: number;
  /** Ticked Markdown checkboxes. Author annotations, never execution evidence. */
  ticked: number;
  withoutCriteria: Spec[];
  /** Specs that have at least one criterion without a stable ID, with how many. */
  missingIds: { spec: Spec; count: number }[];
}

export function acceptanceCoverage(specs: Spec[]): AcceptanceCoverage {
  let total = 0;
  let withId = 0;
  let ticked = 0;
  const withoutCriteria: Spec[] = [];
  const missingIds: { spec: Spec; count: number }[] = [];
  for (const spec of specs) {
    total += spec.acceptance.length;
    if (spec.acceptance.length === 0) withoutCriteria.push(spec);
    let missing = 0;
    for (const ac of spec.acceptance) {
      if (ac.id) withId += 1;
      else missing += 1;
      if (ac.checked) ticked += 1;
    }
    if (missing) missingIds.push({ spec, count: missing });
  }
  return { total, withId, ticked, withoutCriteria, missingIds };
}

export const FINDING_GROUPS = ['code', 'path', 'spec'] as const;
export type FindingGroupBy = (typeof FINDING_GROUPS)[number];
export const SEVERITY_FILTERS = ['all', 'error', 'warning'] as const;
export type SeverityFilter = (typeof SEVERITY_FILTERS)[number];

export interface FindingView {
  group: FindingGroupBy;
  severity: SeverityFilter;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Unknown or missing values fall back to grouping by code with every severity. */
export function parseFindingView(params: {
  group?: string | string[];
  severity?: string | string[];
}): FindingView {
  const group = first(params.group);
  const severity = first(params.severity);
  return {
    group: FINDING_GROUPS.find((g) => g === group) ?? 'code',
    severity: SEVERITY_FILTERS.find((s) => s === severity) ?? 'all',
  };
}

/** Group key for findings on files that are not an interaction specification. */
export const OUTSIDE_SPECS = '';

export interface FindingGroup {
  /** Code, path or spec ID; `OUTSIDE_SPECS` for the spec grouping's remainder. */
  key: string;
  spec: Spec | null;
  errors: number;
  warnings: number;
  findings: Finding[];
}

export interface GroupedFindings {
  total: number;
  shown: number;
  groups: FindingGroup[];
}

/** Every finding that passes the filter lands in exactly one group; largest groups first. */
export function groupFindings(
  findings: Finding[],
  specs: Spec[],
  view: FindingView,
): GroupedFindings {
  const byPath = new Map(specs.map((s) => [s.path, s]));
  const shown = findings.filter((f) => view.severity === 'all' || f.severity === view.severity);
  const groups = new Map<string, FindingGroup>();
  for (const f of shown) {
    const spec = view.group === 'spec' ? (byPath.get(f.path) ?? null) : null;
    const key =
      view.group === 'code' ? f.code : view.group === 'path' ? f.path : (spec?.id ?? OUTSIDE_SPECS);
    let group = groups.get(key);
    if (!group) {
      group = { key, spec, errors: 0, warnings: 0, findings: [] };
      groups.set(key, group);
    }
    group.findings.push(f);
    if (f.severity === 'error') group.errors += 1;
    else group.warnings += 1;
  }
  const sorted = [...groups.values()].sort(
    (a, b) =>
      Number(a.key === OUTSIDE_SPECS) - Number(b.key === OUTSIDE_SPECS) ||
      b.findings.length - a.findings.length ||
      b.errors - a.errors ||
      a.key.localeCompare(b.key),
  );
  return { total: findings.length, shown: shown.length, groups: sorted };
}

/** The fields of a stored check the trend needs. */
export interface StoredCheck {
  sha: string;
  ok: boolean;
  errors: number;
  warnings: number;
  specs: number;
  analyzedAt: string;
}

/** Stored checks oldest first, so the chart reads left to right in check time. */
export function checkTrend<T extends StoredCheck>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.analyzedAt.localeCompare(b.analyzedAt));
}

/** Round an axis maximum up to a clean tick step and return the ticks from zero. */
export function axisTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const steps = Math.max(1, Math.ceil(max / step));
  return Array.from({ length: steps + 1 }, (_, i) => i * Math.max(1, Math.round(step)));
}

/** Integer share, so labels like "33%" add up visually without implying decimals. */
export function share(count: number, total: number): string {
  if (total === 0) return '0%';
  const pct = (count / total) * 100;
  if (pct > 0 && pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

/**
 * Query string for a findings view on a page whose revision is selected by `targetQuery`
 * (`''`, `?ref=…` or `?pr=…`). Default values are omitted so plain links stay short.
 */
export function findingViewQuery(targetQuery: string, view: FindingView): string {
  const params = new URLSearchParams(targetQuery.startsWith('?') ? targetQuery.slice(1) : '');
  params.delete('group');
  params.delete('severity');
  if (view.group !== 'code') params.set('group', view.group);
  if (view.severity !== 'all') params.set('severity', view.severity);
  const query = params.toString();
  return query ? `?${query}` : '';
}
