/** Client-safe reader types and queries: no Node imports, so filters and search run in the browser. */

/** One row of the interaction inventory, joined with its spec document when one exists. */
export interface InteractionRow {
  id: string;
  title: string;
  summary: string;
  categoryKey: string;
  categoryTitle: string;
  featureId: string;
  featureTitle: string;
  type: string;
  /** Declared lifecycle from the inventory. Not executed evidence. */
  lifecycle: string;
  phase: string;
  region: string;
  /** null when the inventory lists the interaction but no spec document exists yet. */
  spec: { path: string; documentStatus: string; acceptance: number } | null;
  errors: number;
  warnings: number;
}

export interface SearchEntry {
  kind: 'interaction' | 'document';
  id: string | null;
  title: string;
  path: string | null;
  href: string;
  /** Short context shown under the title. */
  detail: string;
  /** Lowercase text the search matches against. */
  text: string;
}

/** Rank entries for a query: every word must match; ID and title matches come first. */
export function searchMatches(entries: SearchEntry[], query: string, limit = 20): SearchEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return entries.slice(0, limit);
  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    if (!words.every((w) => entry.text.includes(w))) continue;
    const head = `${entry.id ?? ''} ${entry.title}`.toLowerCase();
    const score = words.reduce(
      (sum, w) => sum + (head.startsWith(w) ? 3 : head.includes(w) ? 2 : 0),
      entry.kind === 'interaction' ? 1 : 0,
    );
    scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

/** Filter state for the interaction table. Empty sets mean "any". */
export interface RowFilter {
  query: string;
  categories: string[];
  lifecycles: string[];
  phases: string[];
  types: string[];
  /** `with` keeps rows with a spec document, `without` keeps inventory-only rows. */
  document: 'any' | 'with' | 'without';
  findingsOnly: boolean;
}

export const EMPTY_FILTER: RowFilter = {
  query: '',
  categories: [],
  lifecycles: [],
  phases: [],
  types: [],
  document: 'any',
  findingsOnly: false,
};

export function filterRows(rows: InteractionRow[], filter: RowFilter): InteractionRow[] {
  const words = filter.query.toLowerCase().split(/\s+/).filter(Boolean);
  const any = (set: string[], value: string) => set.length === 0 || set.includes(value);
  return rows.filter(
    (r) =>
      any(filter.categories, r.categoryKey) &&
      any(filter.lifecycles, r.lifecycle) &&
      any(filter.phases, r.phase) &&
      any(filter.types, r.type) &&
      (filter.document === 'any' || (filter.document === 'with') === (r.spec !== null)) &&
      (!filter.findingsOnly || r.errors + r.warnings > 0) &&
      words.every((w) =>
        `${r.id} ${r.title} ${r.summary} ${r.featureTitle}`.toLowerCase().includes(w),
      ),
  );
}

/** Distinct values with counts, in first-seen order, for building filter menus. */
export function facet(
  rows: InteractionRow[],
  pick: (r: InteractionRow) => string,
): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = pick(r);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ value, count }));
}
