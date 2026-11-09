import type { Spec } from '@spectrum/core';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
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
  type AcceptanceCoverage,
  axisTicks,
  type CategoryRow,
  FINDING_GROUPS,
  type FindingGroupBy,
  type FindingView,
  findingViewQuery,
  type GroupedFindings,
  OUTSIDE_SPECS,
  type Part,
  type SeverityFilter,
  type StatusDistribution,
  type StoredCheck,
  share,
} from '../lib/overview.ts';
import { EmptyNotice, Mono, Section, StatCard, StatusBadge } from './dashboard.tsx';

/*
 * Chart color follows the spectrum-ui design rules: ordered states use one ramp of the indigo brand
 * accent, mixed from the theme's background up to the accent and then toward its foreground, so
 * the ramp re-steps itself in dark mode. Errors use the destructive token and warnings the warning
 * token; neither appears anywhere else in a chart. Every value a chart shows is also printed as text.
 * The ramp was checked with the dataviz palette validator (ordinal, light and dark) for up to six
 * steps.
 */

/**
 * Ramp position of step `index` of `count`, from 0 (faint) to 1 (strongest). Few steps use a
 * narrower band around the accent, so two values read as two shades of it rather than as the
 * ramp's extremes; four or more steps use the whole ramp.
 */
function rampStep(index: number, count: number): number {
  if (count <= 1) return 0.75;
  const span = Math.min(1, 0.45 * (count - 1));
  const start = Math.min(Math.max(0.6 - span / 2, 0), 1 - span);
  return start + (index / (count - 1)) * span;
}

/** The first three quarters rise from 50% accent to the accent; the rest deepens it by up to 45%. */
function rampFill(step: number): CSSProperties {
  if (step <= 0.75) {
    const mix = Math.round(50 + (step / 0.75) * 50);
    return { background: `color-mix(in oklch, var(--brand) ${mix}%, var(--background))` };
  }
  const mix = Math.round(100 - ((step - 0.75) / 0.25) * 45);
  return { background: `color-mix(in oklch, var(--brand) ${mix}%, var(--foreground))` };
}

/**
 * Label ink for text set inside a ramp fill. The ramp mirrors between modes, so one threshold
 * keeps every label at 4.8:1 or better in both.
 */
function rampInk(step: number): string {
  return step < 0.5 ? 'text-foreground' : 'text-background';
}

const ERROR_FILL: CSSProperties = { background: 'var(--destructive)' };
const WARNING_FILL: CSSProperties = { background: 'var(--warning)' };

/** Assigns each value its ramp step once, so the same value keeps its shade in every chart. */
export function rampFor(parts: Part[]): (value: string) => number {
  const index = new Map(parts.map((p, i) => [p.value, i]));
  return (value) => rampStep(index.get(value) ?? 0, parts.length);
}

function label(value: string) {
  return value.replaceAll('_', ' ');
}

/** Hover and focus readout. Values lead; the readout never carries the only copy of a value. */
function Tip({ children, align = 'center' }: { children: ReactNode; align?: 'center' | 'start' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute bottom-full z-20 mb-2 hidden w-max max-w-56 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm',
        'group-hover:block group-focus-visible:block',
        align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0',
      )}
    >
      {children}
    </span>
  );
}

function Swatch({ style, className }: { style: CSSProperties; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2.5 shrink-0 rounded-sm', className)}
      style={style}
    />
  );
}

/**
 * One whole split into parts. `tall` prints each share inside its block when it fits; `thin`
 * relies on the figures printed beside it.
 */
export function SegmentedBar({
  parts,
  total,
  stepFor,
  size = 'tall',
  name,
}: {
  parts: Part[];
  total: number;
  stepFor: (value: string) => number;
  size?: 'tall' | 'thin';
  name: string;
}) {
  const visible = parts.filter((p) => p.count > 0);
  const summary = visible.map((p) => `${label(p.value)} ${p.count}`).join(', ');
  return (
    <div
      role="img"
      aria-label={`${name}: ${summary}`}
      className={cn('flex w-full gap-0.5', size === 'tall' ? 'h-7' : 'h-2')}
    >
      {visible.map((p) => {
        const step = stepFor(p.value);
        const pct = (p.count / total) * 100;
        return (
          <span
            key={p.value}
            className={cn(
              'group relative flex min-w-0.5 items-center',
              size === 'tall' ? 'rounded px-1.5' : 'rounded-full',
            )}
            style={{ ...rampFill(step), width: `${pct}%` }}
          >
            {size === 'tall' && pct >= 12 ? (
              <span className={cn('text-[11px] font-medium tabular-nums', rampInk(step))}>
                {share(p.count, total)}
              </span>
            ) : null}
            <Tip>
              <strong className="font-semibold tabular-nums">{p.count}</strong>{' '}
              <span className="text-muted-foreground">
                {label(p.value)} · {share(p.count, total)}
              </span>
            </Tip>
          </span>
        );
      })}
    </div>
  );
}

function Legend({
  parts,
  total,
  stepFor,
}: {
  parts: Part[];
  total: number;
  stepFor: (value: string) => number;
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {parts.map((p) => (
        <li key={p.value} className="flex items-center gap-1.5">
          <Swatch style={rampFill(stepFor(p.value))} />
          <span>{label(p.value)}</span>
          <span className="text-muted-foreground tabular-nums">
            {p.count} · {share(p.count, total)}
          </span>
        </li>
      ))}
    </ul>
  );
}

const DISTRIBUTIONS = [
  { key: 'review', title: 'Document review', note: 'Declared in each spec’s frontmatter.' },
  {
    key: 'lifecycle',
    title: 'Declared lifecycle',
    note: 'Status column of the feature inventory.',
  },
  { key: 'phase', title: 'Phase', note: 'Planning horizon from FI.' },
] as const;

export function StatusDistributionPanel({
  distribution,
  categories,
}: {
  distribution: StatusDistribution;
  categories: CategoryRow[];
}) {
  const lifecycleStep = rampFor(distribution.lifecycle);
  return (
    <Section
      title="Spec health"
      description={`How ${distribution.total} interaction specs split by declared state.`}
    >
      <div className="grid gap-6 rounded-xl border p-4 sm:p-5">
        {DISTRIBUTIONS.map(({ key, title, note }) => {
          const parts = distribution[key];
          const stepFor = key === 'lifecycle' ? lifecycleStep : rampFor(parts);
          return (
            <div key={key} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="text-xs text-muted-foreground">{note}</p>
              </div>
              <SegmentedBar
                parts={parts}
                total={distribution.total}
                stepFor={stepFor}
                name={title}
              />
              <Legend parts={parts} total={distribution.total} stepFor={stepFor} />
            </div>
          );
        })}
      </div>

      {categories.length ? (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Category</TableHead>
                <TableHead className="text-right w-16">Specs</TableHead>
                <TableHead className="min-w-24">Declared lifecycle</TableHead>
                <TableHead className="text-right w-20">Criteria</TableHead>
                <TableHead className="text-right w-20">Findings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((row) => (
                <TableRow key={row.categoryKey}>
                  <TableCell>
                    <Mono>{row.categoryKey}</Mono>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.specs}</TableCell>
                  <TableCell>
                    <SegmentedBar
                      parts={row.lifecycle}
                      total={row.specs}
                      stepFor={lifecycleStep}
                      size="thin"
                      name={`${row.categoryKey} declared lifecycle`}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.acceptance}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.findings}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </Section>
  );
}

function SpecLinks({
  items,
  hrefFor,
}: {
  items: { spec: Spec; note?: string }[];
  hrefFor: (spec: Spec) => string;
}) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {items.map(({ spec, note }) => (
        <li key={spec.path} className="flex flex-wrap items-baseline gap-x-2">
          <Link
            href={hrefFor(spec)}
            className="font-mono text-xs font-medium underline-offset-4 hover:underline"
          >
            {spec.id}
          </Link>
          <span className="text-muted-foreground">{spec.title}</span>
          {note ? <span className="text-xs text-muted-foreground">· {note}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function AcceptancePanel({
  coverage,
  specCount,
  hrefFor,
}: {
  coverage: AcceptanceCoverage;
  specCount: number;
  hrefFor: (spec: Spec) => string;
}) {
  const { total, withId, ticked, withoutCriteria, missingIds } = coverage;
  const idShare = total ? (withId / total) * 100 : 0;
  return (
    <Section
      title="Acceptance criteria"
      description="Criteria stated in each spec and whether they carry a stable ID."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Criteria" value={total}>
          across {specCount} specs
        </StatCard>
        <StatCard title="Stable IDs" value={share(withId, total)}>
          <div aria-hidden className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand" style={{ width: `${idShare}%` }} />
          </div>
          {withId} of {total} carry an <Mono>AC-</Mono> ID
        </StatCard>
        <StatCard title="Specs without criteria" value={withoutCriteria.length}>
          of {specCount} specs
        </StatCard>
        <StatCard title="Ticked by authors" value={ticked}>
          Checkbox annotations, not test results
        </StatCard>
      </div>
      {withoutCriteria.length || missingIds.length ? (
        <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 sm:p-5">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">No acceptance criteria</h3>
            {withoutCriteria.length ? (
              <SpecLinks items={withoutCriteria.map((spec) => ({ spec }))} hrefFor={hrefFor} />
            ) : (
              <p className="text-sm text-muted-foreground">Every spec states criteria.</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Criteria without a stable ID</h3>
            {missingIds.length ? (
              <SpecLinks
                items={missingIds.map(({ spec, count }) => ({
                  spec,
                  note: `${count} without ID`,
                }))}
                hrefFor={hrefFor}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Every criterion has a stable ID.</p>
            )}
          </div>
        </div>
      ) : null}
    </Section>
  );
}

const GROUP_LABELS: Record<FindingGroupBy, string> = {
  code: 'Code',
  path: 'File',
  spec: 'Spec',
};
const SEVERITY_LABELS: Record<SeverityFilter, string> = {
  all: 'All',
  error: 'Errors',
  warning: 'Warnings',
};

function Toggle({
  label: name,
  options,
}: {
  label: string;
  options: { key: string; label: string; href: string; current: boolean }[];
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{name}</span>
      <div className="inline-flex rounded-md border p-0.5">
        {options.map((o) => (
          <Link
            key={o.key}
            href={o.href}
            scroll={false}
            aria-current={o.current ? 'true' : undefined}
            className={cn(
              'rounded px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring',
              o.current
                ? 'bg-primary font-medium text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Findings grouped by code, file or spec, as a ranked bar chart whose rows expand to the findings.
 * `pagePath` and `targetQuery` rebuild links for the same page and revision.
 */
export function FindingsPanel({
  grouped,
  view,
  pagePath,
  targetQuery,
  specHref,
  sourceUrl,
  emptyNote,
}: {
  grouped: GroupedFindings;
  view: FindingView;
  pagePath: string;
  targetQuery: string;
  specHref: (spec: Spec) => string;
  sourceUrl?: (path: string, line?: number) => string;
  emptyNote?: ReactNode;
}) {
  const href = (next: FindingView) => `${pagePath}${findingViewQuery(targetQuery, next)}#findings`;
  const max = Math.max(1, ...grouped.groups.map((g) => g.findings.length));
  return (
    <Section
      id="findings"
      title="Findings"
      description="Structural findings from the shared engine, grouped by code, file or spec."
    >
      {emptyNote}
      {grouped.total === 0 ? null : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Toggle
            label="Group by"
            options={FINDING_GROUPS.map((g) => ({
              key: g,
              label: GROUP_LABELS[g],
              href: href({ ...view, group: g }),
              current: view.group === g,
            }))}
          />
          <Toggle
            label="Severity"
            options={(['all', 'error', 'warning'] as const).map((s) => ({
              key: s,
              label: SEVERITY_LABELS[s],
              href: href({ ...view, severity: s }),
              current: view.severity === s,
            }))}
          />
          <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {grouped.shown} of {grouped.total} findings · {grouped.groups.length}{' '}
            {grouped.groups.length === 1 ? 'group' : 'groups'}
          </p>
          <ul className="flex gap-3 text-xs text-muted-foreground sm:ml-auto">
            <li className="flex items-center gap-1.5">
              <Swatch style={ERROR_FILL} /> error
            </li>
            <li className="flex items-center gap-1.5">
              <Swatch style={WARNING_FILL} /> warning
            </li>
          </ul>
        </div>
      )}
      {grouped.total > 0 && grouped.shown === 0 ? (
        <EmptyNotice>
          No {view.severity === 'error' ? 'errors' : 'warnings'} at this revision.{' '}
          <Link href={href({ ...view, severity: 'all' })} className="underline underline-offset-4">
            Show all findings
          </Link>
        </EmptyNotice>
      ) : null}
      {grouped.groups.length ? (
        <div className="divide-y rounded-xl border">
          {grouped.groups.map((g) => (
            <details key={g.key || 'outside'} className="group/row">
              <summary className="grid cursor-pointer list-none grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[1rem_minmax(0,14rem)_1fr_auto] px-3 py-2.5 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  aria-hidden
                  className="size-4 text-muted-foreground transition-transform group-open/row:rotate-90"
                />
                <span
                  className="min-w-0 font-mono text-xs break-all sm:truncate sm:break-normal"
                  title={g.key || undefined}
                >
                  {g.key === OUTSIDE_SPECS ? (
                    <span className="font-sans text-muted-foreground">Not in a specification</span>
                  ) : (
                    g.key
                  )}
                </span>
                <span
                  aria-hidden
                  className="col-span-2 col-start-2 row-start-2 flex h-3 gap-0.5 sm:col-span-1 sm:col-start-3 sm:row-start-1"
                  style={{ width: `${(g.findings.length / max) * 100}%` }}
                >
                  {g.errors ? (
                    <span
                      className={cn('h-full', g.warnings ? '' : 'rounded-r')}
                      style={{ ...ERROR_FILL, flexGrow: g.errors }}
                    />
                  ) : null}
                  {g.warnings ? (
                    <span
                      className="h-full rounded-r"
                      style={{ ...WARNING_FILL, flexGrow: g.warnings }}
                    />
                  ) : null}
                </span>
                <span className="col-start-3 row-start-1 text-right text-xs tabular-nums sm:col-start-4">
                  <span className="font-medium">{g.findings.length}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {g.errors} err, {g.warnings} warn
                  </span>
                </span>
              </summary>
              <div className="border-t bg-muted/20 px-3 py-2">
                {g.spec ? (
                  <Link
                    href={specHref(g.spec)}
                    className="mb-2 inline-flex text-xs underline-offset-4 hover:underline"
                  >
                    Open {g.spec.id}
                  </Link>
                ) : null}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Severity</TableHead>
                      {view.group === 'code' ? null : <TableHead>Code</TableHead>}
                      {view.group === 'path' ? null : <TableHead>Path</TableHead>}
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.findings.map((f, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: Findings have no IDs and can repeat; this read-only list is server-rendered.
                      <TableRow key={`${f.code}:${f.path}:${f.line ?? ''}:${i}`}>
                        <TableCell>
                          <StatusBadge tone={f.severity === 'error' ? 'bad' : 'neutral'}>
                            {f.severity}
                          </StatusBadge>
                        </TableCell>
                        {view.group === 'code' ? null : (
                          <TableCell>
                            <Mono>{f.code}</Mono>
                          </TableCell>
                        )}
                        {view.group === 'path' ? null : (
                          <TableCell>
                            <FindingPath path={f.path} line={f.line} sourceUrl={sourceUrl} />
                          </TableCell>
                        )}
                        <TableCell className="whitespace-normal text-muted-foreground">
                          {f.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

function FindingPath({
  path,
  line,
  sourceUrl,
}: {
  path: string;
  line?: number;
  sourceUrl?: (path: string, line?: number) => string;
}) {
  const text = `${path}${line ? `:${line}` : ''}`;
  if (!sourceUrl) return <Mono>{text}</Mono>;
  return (
    <a
      href={sourceUrl(path, line)}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs underline-offset-4 hover:underline"
    >
      {text}
    </a>
  );
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function short(sha: string) {
  return sha.slice(0, 7);
}

function when(iso: string) {
  return `${iso.replace('T', ' ').slice(0, 16)} UTC`;
}

/** Recessive hairline grid with tick labels; the plot itself is drawn by the caller. */
function Plot({
  ticks,
  height,
  children,
}: {
  ticks: number[];
  height: string;
  children: ReactNode;
}) {
  const top = ticks[ticks.length - 1] || 1;
  return (
    <div className="grid grid-cols-[2rem_1fr] gap-2">
      <div className={cn('relative', height)} aria-hidden>
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute right-0 translate-y-1/2 text-[10px] leading-none text-muted-foreground tabular-nums"
            style={{ bottom: `${(t / top) * 100}%` }}
          >
            {t}
          </span>
        ))}
      </div>
      <div className={cn('relative', height)}>
        {ticks.map((t) => (
          <span
            key={t}
            aria-hidden
            className="absolute inset-x-0 h-px bg-border"
            style={{ bottom: `${(t / top) * 100}%` }}
          />
        ))}
        {children}
      </div>
    </div>
  );
}

function TrendAxis({ first, last }: { first: StoredCheck; last: StoredCheck }) {
  return (
    <div className="ml-10 flex justify-between text-[10px] text-muted-foreground tabular-nums">
      <span>{when(first.analyzedAt)}</span>
      {first === last ? null : <span>{when(last.analyzedAt)}</span>}
    </div>
  );
}

/**
 * Stored checks, oldest first. Errors and warnings stack per check; specs read get their own chart
 * so the two measures never share an axis. `hrefFor` links a check to that commit's overview.
 */
export function CheckTrendPanel({
  rows,
  currentSha,
  hrefFor,
  unavailable,
}: {
  rows: StoredCheck[] | null;
  currentSha: string | undefined;
  hrefFor: (sha: string) => string;
  /** Why history is unavailable, when `rows` is null. */
  unavailable?: ReactNode;
}) {
  const description =
    'One deterministic structural check per commit, ordered by check time, not commit order.';
  if (!rows) {
    return (
      <Section title="Check trend" description={description}>
        <EmptyNotice>
          {unavailable ??
            'No check history is stored. Checks are kept per commit only when accounts are enabled.'}
        </EmptyNotice>
      </Section>
    );
  }
  if (!rows.length) {
    return (
      <Section title="Check trend" description={description}>
        <EmptyNotice>No checks are stored for this repository yet.</EmptyNotice>
      </Section>
    );
  }
  const findingTicks = axisTicks(Math.max(...rows.map((r) => r.errors + r.warnings)));
  const findingTop = findingTicks[findingTicks.length - 1] || 1;
  const specTicks = axisTicks(Math.max(...rows.map((r) => r.specs)), 2);
  const specTop = specTicks[specTicks.length - 1] || 1;
  const n = rows.length;
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const first = rows[0];
  const last = rows[n - 1];
  const columns = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  return (
    <Section title="Check trend" description={description}>
      <div className="grid gap-6 rounded-xl border p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="text-sm font-medium">Findings per check</h3>
            <ul className="flex gap-3 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Swatch style={ERROR_FILL} /> errors
              </li>
              <li className="flex items-center gap-1.5">
                <Swatch style={WARNING_FILL} /> warnings
              </li>
            </ul>
          </div>
          <Plot ticks={findingTicks} height="h-36">
            <div className="absolute inset-0 grid" style={columns}>
              {rows.map((r) => {
                const current = r.sha === currentSha;
                const total = r.errors + r.warnings;
                return (
                  <Link
                    key={r.sha}
                    href={hrefFor(r.sha)}
                    aria-label={`${short(r.sha)}: ${plural(r.errors, 'error')}, ${plural(r.warnings, 'warning')}, checked ${when(r.analyzedAt)}${current ? ', shown' : ''}`}
                    aria-current={current ? 'true' : undefined}
                    className="group relative flex h-full flex-col items-center justify-end outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className="flex w-full max-w-6 flex-col-reverse gap-0.5 px-0.5"
                      style={{ height: `${(total / findingTop) * 100}%` }}
                    >
                      {r.errors ? (
                        <span
                          className={cn('w-full', r.warnings ? '' : 'rounded-t')}
                          style={{ ...ERROR_FILL, flexGrow: r.errors }}
                        />
                      ) : null}
                      {r.warnings ? (
                        <span
                          className="w-full rounded-t"
                          style={{ ...WARNING_FILL, flexGrow: r.warnings }}
                        />
                      ) : null}
                    </span>
                    {current ? (
                      <span
                        aria-hidden
                        className="absolute -bottom-2 size-1.5 rounded-full bg-brand"
                      />
                    ) : null}
                    <Tip>
                      <strong className="font-semibold tabular-nums">{total}</strong>{' '}
                      <span className="text-muted-foreground">
                        findings · {r.errors} err, {r.warnings} warn
                      </span>
                      <br />
                      <span className="font-mono">{short(r.sha)}</span>{' '}
                      <span className="text-muted-foreground">
                        {when(r.analyzedAt)}
                        {current ? ' · shown' : ''}
                      </span>
                    </Tip>
                  </Link>
                );
              })}
            </div>
          </Plot>
          <TrendAxis first={first} last={last} />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Specs read per check</h3>
          <Plot ticks={specTicks} height="h-20">
            <svg
              aria-hidden
              className="absolute inset-0 size-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <polyline
                fill="none"
                stroke="var(--brand)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                points={rows.map((r, i) => `${x(i)},${100 - (r.specs / specTop) * 100}`).join(' ')}
              />
            </svg>
            <div className="absolute inset-0 grid" style={columns}>
              {rows.map((r) => (
                <span key={r.sha} className="group relative h-full">
                  <span
                    aria-hidden
                    className="absolute left-1/2 size-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-brand ring-2 ring-background"
                    style={{ bottom: `${(r.specs / specTop) * 100}%` }}
                  />
                  <Tip>
                    <strong className="font-semibold tabular-nums">{r.specs}</strong>{' '}
                    <span className="text-muted-foreground">specs</span>
                    <br />
                    <span className="font-mono">{short(r.sha)}</span>
                  </Tip>
                </span>
              ))}
            </div>
          </Plot>
          <TrendAxis first={first} last={last} />
        </div>
        {n === 1 ? (
          <p className="text-xs text-muted-foreground">
            One check is stored. A trend needs at least two.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Latest: <span className="font-mono">{short(last.sha)}</span>,{' '}
            {plural(last.errors, 'error')}, {plural(last.warnings, 'warning')},{' '}
            {plural(last.specs, 'spec')}. The check history table lists every value.
          </p>
        )}
      </div>
    </Section>
  );
}
