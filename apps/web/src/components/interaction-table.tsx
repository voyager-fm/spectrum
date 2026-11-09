'use client';

import { ChevronDown, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Fragment, type ReactNode, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  EMPTY_FILTER,
  facet,
  filterRows,
  type InteractionRow,
  type RowFilter,
} from '../lib/reader-query.ts';
import { LifecycleDot } from './spec-nav.tsx';

export interface TableRowLink extends InteractionRow {
  href: string;
}

type ListKey = 'categories' | 'lifecycles' | 'phases' | 'types';
const PARAM: Record<ListKey, string> = {
  categories: 'category',
  lifecycles: 'lifecycle',
  phases: 'phase',
  types: 'type',
};
const DOCUMENT_LABEL: Record<RowFilter['document'], string> = {
  any: 'Any',
  with: 'Has spec document',
  without: 'Inventory only',
};

function readFilter(params: URLSearchParams): RowFilter {
  const list = (key: string) => params.get(key)?.split(',').filter(Boolean) ?? [];
  const doc = params.get('document');
  return {
    query: params.get('q') ?? '',
    categories: list(PARAM.categories),
    lifecycles: list(PARAM.lifecycles),
    phases: list(PARAM.phases),
    types: list(PARAM.types),
    document: doc === 'with' || doc === 'without' ? doc : 'any',
    findingsOnly: params.get('findings') === '1',
  };
}

function writeFilter(params: URLSearchParams, filter: RowFilter): string {
  const next = new URLSearchParams(params);
  const set = (key: string, value: string) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  set('q', filter.query.trim());
  for (const key of Object.keys(PARAM) as ListKey[]) set(PARAM[key], filter[key].join(','));
  set('document', filter.document === 'any' ? '' : filter.document);
  set('findings', filter.findingsOnly ? '1' : '');
  const query = next.toString();
  return query ? `?${query}` : '';
}

function FacetMenu({
  label,
  options,
  selected,
  onChange,
  render,
}: {
  label: string;
  options: { value: string; count: number }[];
  selected: string[];
  onChange: (values: string[]) => void;
  render?: (value: string) => ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(selected.length && 'border-foreground')}
          />
        }
      >
        {label}
        {selected.length ? (
          <span className="rounded bg-foreground px-1 font-mono text-[10px] text-background">
            {selected.length}
          </span>
        ) : null}
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {options.map((o) => (
            <DropdownMenuCheckboxItem
              key={o.value}
              checked={selected.includes(o.value)}
              onCheckedChange={(checked) =>
                onChange(checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))
              }
            >
              <span className="flex flex-1 items-center gap-2">
                {render ? render(o.value) : o.value}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {o.count}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Every declared interaction with filters for category, lifecycle, phase, type, document and
 * findings. Filters live in the URL so a filtered view can be shared or reloaded.
 */
export function InteractionTable({ rows }: { rows: TableRowLink[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [filter, setFilterState] = useState<RowFilter>(() => readFilter(params));

  const setFilter = (next: RowFilter) => {
    setFilterState(next);
    router.replace(`${pathname}${writeFilter(params, next)}`, { scroll: false });
  };
  const update = (patch: Partial<RowFilter>) => setFilter({ ...filter, ...patch });

  const visible = useMemo(() => filterRows(rows, filter) as TableRowLink[], [rows, filter]);
  const categoryTitles = useMemo(
    () => new Map(rows.map((r) => [r.categoryKey, r.categoryTitle])),
    [rows],
  );
  const facets = useMemo(
    () => ({
      categories: facet(rows, (r) => r.categoryKey),
      lifecycles: facet(rows, (r) => r.lifecycle),
      phases: facet(rows, (r) => r.phase),
      types: facet(rows, (r) => r.type),
    }),
    [rows],
  );
  const active =
    JSON.stringify({ ...filter, query: filter.query.trim() }) !== JSON.stringify(EMPTY_FILTER);

  const chips: { key: string; label: string; clear: () => void }[] = [];
  for (const key of Object.keys(PARAM) as ListKey[])
    for (const value of filter[key])
      chips.push({
        key: `${key}:${value}`,
        label: key === 'categories' ? `${value} · ${categoryTitles.get(value) ?? value}` : value,
        clear: () => update({ [key]: filter[key].filter((v) => v !== value) }),
      });
  if (filter.document !== 'any')
    chips.push({
      key: 'document',
      label: DOCUMENT_LABEL[filter.document],
      clear: () => update({ document: 'any' }),
    });
  if (filter.findingsOnly)
    chips.push({
      key: 'findings',
      label: 'With findings',
      clear: () => update({ findingsOnly: false }),
    });

  let lastCategory: string | null = null;

  return (
    <div className="flex flex-col gap-3">
      <search className="flex flex-wrap items-center gap-2" aria-label="Filter interactions">
        <div className="relative w-full sm:w-56">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={filter.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder="Filter by ID, title or summary"
            aria-label="Filter by text"
            className="h-7 w-full rounded-lg border bg-transparent pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <FacetMenu
          label="Category"
          options={facets.categories}
          selected={filter.categories}
          onChange={(categories) => update({ categories })}
          render={(v) => (
            <>
              <span className="font-mono text-[11px] text-muted-foreground">{v}</span>
              {categoryTitles.get(v)}
            </>
          )}
        />
        <FacetMenu
          label="Lifecycle"
          options={facets.lifecycles}
          selected={filter.lifecycles}
          onChange={(lifecycles) => update({ lifecycles })}
          render={(v) => (
            <>
              <LifecycleDot lifecycle={v} />
              {v}
            </>
          )}
        />
        <FacetMenu
          label="Phase"
          options={facets.phases}
          selected={filter.phases}
          onChange={(phases) => update({ phases })}
        />
        <FacetMenu
          label="Type"
          options={facets.types}
          selected={filter.types}
          onChange={(types) => update({ types })}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  (filter.document !== 'any' || filter.findingsOnly) && 'border-foreground',
                )}
              />
            }
          >
            More
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Spec document</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={filter.document}
                onValueChange={(document) =>
                  update({ document: document as RowFilter['document'] })
                }
              >
                {(Object.keys(DOCUMENT_LABEL) as RowFilter['document'][]).map((key) => (
                  <DropdownMenuRadioItem key={key} value={key}>
                    {DOCUMENT_LABEL[key]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Structural check</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={filter.findingsOnly}
                onCheckedChange={(findingsOnly) => update({ findingsOnly })}
              >
                With findings only
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {visible.length} of {rows.length}
        </span>
      </search>

      {chips.length ? (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={chip.clear}
                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {chip.label}
                <X className="size-3 text-muted-foreground" aria-label="Remove filter" />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setFilter(EMPTY_FILTER)}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Clear all
            </button>
          </li>
        </ul>
      ) : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Interaction</TableHead>
              <TableHead className="hidden xl:table-cell">Feature</TableHead>
              <TableHead>Lifecycle</TableHead>
              <TableHead className="hidden sm:table-cell">Phase</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="text-right">AC</TableHead>
              <TableHead className="text-right">Findings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No interaction matches these filters.{' '}
                  {active ? (
                    <button
                      type="button"
                      onClick={() => setFilter(EMPTY_FILTER)}
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Clear filters
                    </button>
                  ) : null}
                </TableCell>
              </TableRow>
            ) : null}
            {visible.map((row) => {
              const header = row.categoryKey !== lastCategory;
              lastCategory = row.categoryKey;
              return (
                <Fragment key={row.id}>
                  {header ? (
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={7} className="py-1.5 text-xs font-medium">
                        <span className="mr-2 font-mono text-muted-foreground">
                          {row.categoryKey}
                        </span>
                        {row.categoryTitle}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  <TableRow>
                    <TableCell className="max-w-0 min-w-56 whitespace-normal">
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={row.href}
                          className={cn(
                            'font-medium underline-offset-4 hover:underline',
                            !row.spec && 'text-muted-foreground italic',
                          )}
                        >
                          {row.title}
                        </Link>
                        <span className="truncate font-mono text-[11px] text-muted-foreground">
                          {row.id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-48 truncate text-muted-foreground xl:table-cell">
                      <span title={row.featureTitle}>{row.featureTitle}</span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <LifecycleDot lifecycle={row.lifecycle} />
                        {row.lifecycle || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {row.phase || '—'}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {row.type || '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.spec ? (
                        row.spec.acceptance
                      ) : (
                        <span className="text-muted-foreground" title="No spec document yet">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.errors ? (
                        <span className="font-medium text-destructive">
                          {row.errors + row.warnings}
                        </span>
                      ) : row.warnings ? (
                        row.warnings
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <LifecycleDot lifecycle="implementing" /> implementing
        </span>
        <span className="inline-flex items-center gap-1.5">
          <LifecycleDot lifecycle="planned" /> planned
        </span>
        <span className="inline-flex items-center gap-1.5">
          <LifecycleDot lifecycle="idea" /> idea
        </span>
        <span>
          Lifecycle is declared in the inventory, not executed evidence. Italic rows have no spec
          document yet.
        </span>
      </p>
    </div>
  );
}
