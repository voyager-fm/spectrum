import type { CheckResult, Finding, RepositoryDocument, Spec } from '@spectrum/core';
import { markdownView } from '@spectrum/spec-engine/markdown';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
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
  adjacentSpecs,
  type CategoryRow,
  catalog,
  categoryHref,
  type FeatureRow,
  featureHref,
  type InteractionRow,
  interactionRows,
  type LinkContext,
  linkContext,
  outline,
  type ReaderRoutes,
  type RelatedDocument,
  readerTree,
  relatedDocuments,
  resolveLink,
  searchEntries,
  specHref,
} from '../lib/reader.ts';
import { EmptyNotice, Mono, StatusBadge } from './dashboard.tsx';
import { DocumentTable } from './document-table.tsx';
import { InteractionTable } from './interaction-table.tsx';
import { CodeBlock, Markdown, ResolvedAnchor } from './markdown.tsx';
import { LifecycleDot, SpecNav } from './spec-nav.tsx';

/** Everything the reader pages derive from one check result. */
export interface Reader {
  result: CheckResult;
  routes: ReaderRoutes;
  rows: InteractionRow[];
  categories: CategoryRow[];
  links: LinkContext;
}

export function createReader(result: CheckResult, routes: ReaderRoutes): Reader {
  const rows = interactionRows(result);
  return {
    result,
    routes,
    rows,
    categories: catalog(result, rows),
    links: linkContext(result, routes),
  };
}

/**
 * Three panes: the spec tree on the left, the page in the middle and an optional rail on the
 * right. Below `xl` the rail follows the page; below `lg` the tree collapses above it.
 */
export function ReaderLayout({
  reader,
  rail,
  children,
}: {
  reader: Reader;
  rail?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-reader
      className={cn(
        'grid grid-cols-1 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10',
        rail && 'xl:grid-cols-[15rem_minmax(0,1fr)_13rem]',
      )}
    >
      <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100svh-3rem)] lg:self-start lg:overflow-y-auto lg:pb-6">
        <SpecNav
          tree={readerTree(reader.categories, reader.result.model.documents, reader.routes)}
          search={searchEntries(reader.rows, reader.result, reader.routes, reader.categories)}
          indexHref={`${reader.routes.base}${reader.routes.query}`}
        />
      </aside>
      <div className="min-w-0">
        {children}
        {rail ? <div className="mt-10 border-t pt-6 xl:hidden">{rail}</div> : null}
      </div>
      {rail ? (
        <aside className="hidden xl:sticky xl:top-6 xl:block xl:max-h-[calc(100svh-3rem)] xl:self-start xl:overflow-y-auto">
          {rail}
        </aside>
      ) : null}
    </div>
  );
}

function RailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function RelatedList({ items, empty }: { items: RelatedDocument[]; empty: string }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1 text-[13px]">
      {items.map((item) => (
        <li key={item.path} className="truncate" title={item.path}>
          <ResolvedAnchor link={item.link} className="no-underline hover:underline">
            {item.title}
          </ResolvedAnchor>
        </li>
      ))}
    </ul>
  );
}

/** Right rail: page outline, findings for this file, and the documents around it. */
export function ReaderRail({
  reader,
  path,
  sections,
  findings,
}: {
  reader: Reader;
  path: string;
  sections: { slug: string; text: string }[];
  findings: Finding[];
}) {
  const { linksTo, linkedFrom } = relatedDocuments(path, reader.result, reader.links);
  const source = reader.routes.source?.(path);
  return (
    <div className="flex flex-col gap-6">
      {sections.length ? (
        <RailSection title="On this page">
          <ul className="flex flex-col gap-1 text-[13px]">
            {sections.map((s) => (
              <li key={s.slug} className="truncate">
                <a
                  href={`#${s.slug}`}
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {s.text}
                </a>
              </li>
            ))}
          </ul>
        </RailSection>
      ) : null}
      <RailSection title="Structural check">
        <p className="text-[13px]">
          {findings.length ? (
            <a href="#findings" className="underline underline-offset-4">
              {findings.length} {findings.length === 1 ? 'finding' : 'findings'} in this file
            </a>
          ) : reader.result.ok ? (
            'No findings in this file'
          ) : (
            <span className="text-muted-foreground">
              No findings in this file; the repository needs review.
            </span>
          )}
        </p>
      </RailSection>
      <RailSection title={`Links to (${linksTo.length})`}>
        <RelatedList items={linksTo} empty="No resolved links." />
      </RailSection>
      <RailSection title={`Linked from (${linkedFrom.length})`}>
        <RelatedList items={linkedFrom} empty="No document links here." />
      </RailSection>
      {source ? (
        <RailSection title="Source">
          <a
            href={source}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] underline underline-offset-4"
          >
            View on GitHub
          </a>
        </RailSection>
      ) : null}
    </div>
  );
}

function FindingList({ findings, reader }: { findings: Finding[]; reader: Reader }) {
  if (!findings.length) return null;
  return (
    <section
      id="findings"
      aria-label="Findings for this file"
      className="mb-8 scroll-mt-6 rounded-xl border border-destructive/40"
    >
      <h2 className="border-b border-destructive/40 px-4 py-2 text-sm font-medium">
        {findings.length} {findings.length === 1 ? 'finding' : 'findings'} in this file
      </h2>
      <ul className="flex flex-col divide-y text-sm">
        {findings.map((f) => {
          const line = f.line ? reader.routes.source?.(f.path, f.line) : undefined;
          return (
            <li
              key={`${f.code}:${f.line ?? ''}:${f.message}`}
              className="flex flex-wrap items-baseline gap-2 px-4 py-2"
            >
              <StatusBadge tone={f.severity === 'error' ? 'bad' : 'neutral'}>
                {f.severity}
              </StatusBadge>
              <Mono>{f.code}</Mono>
              <span className="min-w-0 flex-1">{f.message}</span>
              {f.line ? (
                line ? (
                  <a
                    href={line}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    line {f.line}
                  </a>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">line {f.line}</span>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Property({
  label,
  children,
  note,
}: {
  label: string;
  children: ReactNode;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 text-sm">{children}</dd>
      {note ? <dd className="text-[11px] text-muted-foreground">{note}</dd> : null}
    </div>
  );
}

function AcceptanceCriteria({ spec }: { spec: Spec }) {
  if (!spec.acceptance.length)
    return <EmptyNotice>This spec lists no acceptance criteria.</EmptyNotice>;
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">ID</TableHead>
            <TableHead>Criterion</TableHead>
            <TableHead className="w-28">Verification</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {spec.acceptance.map((criterion) => (
            <TableRow
              key={`${criterion.id ?? 'unassigned'}:${criterion.statement}`}
              id={criterion.id ? criterion.id.toLowerCase() : undefined}
              className="scroll-mt-6 target:bg-muted"
            >
              <TableCell className="align-top">
                {criterion.id ? (
                  <a
                    href={`#${criterion.id.toLowerCase()}`}
                    className="font-mono text-xs text-muted-foreground tabular-nums hover:text-foreground"
                  >
                    {criterion.id}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">Unassigned</span>
                )}
              </TableCell>
              <TableCell className="whitespace-normal">{criterion.statement}</TableCell>
              <TableCell className="align-top">
                <StatusBadge tone="planned">Not recorded</StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">
        Checked boxes in the document are not evidence. Verification stays “Not recorded” until an
        evidence adapter supplies an execution record.
      </p>
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  meta,
  level = 1,
}: {
  eyebrow?: ReactNode;
  title: string;
  meta: ReactNode;
  /** 2 inside a page that already has its own h1, such as a connected repository. */
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <header className="mb-6 flex flex-col gap-1.5">
      {eyebrow ? <div className="text-xs text-muted-foreground">{eyebrow}</div> : null}
      <Heading className="text-2xl font-semibold tracking-tight">{title}</Heading>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {meta}
      </div>
    </header>
  );
}

function Adjacent({ reader, id }: { reader: Reader; id: string }) {
  const { previous, next } = adjacentSpecs(reader.rows, id);
  const link = (row: InteractionRow | null) =>
    row ? { href: specHref(reader.routes, row.id), title: row.title } : null;
  return <AdjacentLinks label="Adjacent specs" previous={link(previous)} next={link(next)} />;
}

function AdjacentLinks({
  label,
  previous,
  next,
}: {
  label: string;
  previous: { href: string; title: string } | null;
  next: { href: string; title: string } | null;
}) {
  if (!previous && !next) return null;
  const card = 'flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl border px-4 py-3 hover:bg-muted/50';
  return (
    <nav aria-label={label} className="mt-12 flex gap-3">
      {previous ? (
        <Link href={previous.href} className={card}>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ChevronLeft className="size-3.5" aria-hidden /> Previous
          </span>
          <span className="truncate text-sm font-medium">{previous.title}</span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
      {next ? (
        <Link href={next.href} className={cn(card, 'items-end text-right')}>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Next <ChevronRight className="size-3.5" aria-hidden />
          </span>
          <span className="max-w-full truncate text-sm font-medium">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}

/**
 * One interaction: separate lifecycle, phase, document-status and check values, then the spec
 * document itself with acceptance criteria as a table. An interaction that only exists in the
 * inventory shows its declared fields and says that no document exists yet.
 */
export function SpecPage({
  reader,
  id,
  titleLevel = 1,
}: {
  reader: Reader;
  id: string;
  titleLevel?: 1 | 2;
}) {
  const row = reader.rows.find((r) => r.id === id);
  if (!row) return null;
  const spec = reader.result.specs.find((s) => s.id === id);
  const findings = spec ? reader.result.findings.filter((f) => f.path === spec.path) : [];
  const view = spec ? markdownView(spec.body) : null;
  const resolve = (href: string) => resolveLink(spec?.path ?? '', href, reader.links);
  const source = spec ? reader.routes.source?.(spec.path) : undefined;

  const rail = spec ? (
    <ReaderRail
      reader={reader}
      path={spec.path}
      sections={view ? outline(view.blocks) : []}
      findings={findings}
    />
  ) : undefined;

  return (
    <ReaderLayout reader={reader} rail={rail}>
      <PageTitle
        eyebrow={
          <nav aria-label="Breadcrumb">
            <Link
              href={categoryHref(reader.routes, row.categoryKey)}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              <span className="font-mono">{row.categoryKey}</span> {row.categoryTitle}
            </Link>
            <ChevronRight className="mx-1 inline size-3 align-middle" aria-hidden />
            <Link
              href={featureHref(reader.routes, row.featureId)}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              <span className="font-mono">{row.featureId}</span> {row.featureTitle}
            </Link>
          </nav>
        }
        title={row.title}
        level={titleLevel}
        meta={
          <>
            <Mono>{row.id}</Mono>
            {spec ? (
              source ? (
                <a
                  href={source}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono underline-offset-4 hover:underline"
                >
                  {spec.path}
                </a>
              ) : (
                <span className="break-all font-mono">{spec.path}</span>
              )
            ) : null}
          </>
        }
      />

      <dl className="mb-8 grid grid-cols-2 divide-x divide-y rounded-xl border sm:grid-cols-3 [&>div]:border-border">
        <Property label="Lifecycle" note="Declared in the inventory; not executed evidence.">
          <LifecycleDot lifecycle={row.lifecycle} />
          {row.lifecycle || '—'}
        </Property>
        <Property label="Phase">{row.phase || '—'}</Property>
        <Property label="Type">{row.type || '—'}</Property>
        <Property label="Region">{row.region ? <Mono>{row.region}</Mono> : '—'}</Property>
        <Property label="Document status" note="Review annotation on the document.">
          {spec ? (
            <StatusBadge tone="neutral">{spec.status}</StatusBadge>
          ) : (
            <StatusBadge tone="planned">No document</StatusBadge>
          )}
        </Property>
        <Property label="Structural check">
          {!spec ? (
            <StatusBadge tone="planned">Not assessed</StatusBadge>
          ) : findings.length ? (
            <StatusBadge tone="bad">
              {findings.length} {findings.length === 1 ? 'finding' : 'findings'}
            </StatusBadge>
          ) : reader.result.ok ? (
            <StatusBadge tone="ok">No findings</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Repository needs review</StatusBadge>
          )}
        </Property>
      </dl>

      <FindingList findings={findings} reader={reader} />

      {spec && view ? (
        <Markdown
          blocks={view.blocks}
          resolve={resolve}
          skipTitle
          replace={{ 'Acceptance Criteria': <AcceptanceCriteria spec={spec} /> }}
        />
      ) : (
        <EmptyNotice>
          No spec document exists for this interaction yet.
          {row.summary ? <> The inventory summarizes it as: “{row.summary}”</> : null}
        </EmptyNotice>
      )}

      <Adjacent reader={reader} id={row.id} />
    </ReaderLayout>
  );
}

const KIND_LABEL: Record<RepositoryDocument['kind'], string> = {
  interaction: 'Interaction',
  contract: 'Contract',
  page_contract: 'Page contract',
  flow: 'Flow',
  layout: 'Layout',
  page_spec: 'Page spec',
  surface_contract: 'Surface contract',
  surface_spec: 'Surface spec',
  engineering: 'Engineering',
  rule: 'Rule',
  reference: 'Reference',
  overview: 'Overview',
};

/** A contract, flow, rule or other document, rendered as Markdown or as numbered source. */
export function DocumentPage({
  reader,
  path,
  titleLevel = 1,
}: {
  reader: Reader;
  path: string;
  titleLevel?: 1 | 2;
}) {
  const doc = reader.result.model.documents.find((d) => d.path === path);
  if (!doc) return null;
  const findings = reader.result.findings.filter((f) => f.path === path);
  const isMarkdown = /\.md$/i.test(path);
  const view = isMarkdown ? markdownView(doc.body) : null;
  const source = reader.routes.source?.(path);
  const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toUpperCase();

  return (
    <ReaderLayout
      reader={reader}
      rail={
        <ReaderRail
          reader={reader}
          path={path}
          sections={view ? outline(view.blocks) : []}
          findings={findings}
        />
      }
    >
      <PageTitle
        eyebrow={KIND_LABEL[doc.kind]}
        title={doc.title}
        level={titleLevel}
        meta={
          source ? (
            <a
              href={source}
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono underline-offset-4 hover:underline"
            >
              {path}
            </a>
          ) : (
            <span className="break-all font-mono">{path}</span>
          )
        }
      />
      <FindingList findings={findings} reader={reader} />
      {view ? (
        <Markdown
          blocks={view.blocks}
          resolve={(href) => resolveLink(path, href, reader.links)}
          skipTitle
        />
      ) : (
        <CodeBlock text={doc.body} label={extension} />
      )}
    </ReaderLayout>
  );
}

function Stat({ label, value, href }: { label: string; value: ReactNode; href?: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-background px-4 py-3">
      <dt className="text-xs text-muted-foreground">
        {href ? (
          <a href={href} className="underline-offset-4 hover:text-foreground hover:underline">
            {label}
          </a>
        ) : (
          label
        )}
      </dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

const STATS = 'mb-6 grid gap-px overflow-hidden rounded-xl border bg-border';

const LIFECYCLE_ORDER = ['implemented', 'implementing', 'planned', 'idea'];

/** How many interactions declare each lifecycle, as monotone markers with counts. */
function LifecycleMix({ rows }: { rows: InteractionRow[] }) {
  if (!rows.length) return <span className="text-muted-foreground">—</span>;
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.lifecycle, (counts.get(row.lifecycle) ?? 0) + 1);
  const rank = (v: string) => {
    const i = LIFECYCLE_ORDER.indexOf(v);
    return i < 0 ? LIFECYCLE_ORDER.length : i;
  };
  return (
    <ul className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {[...counts]
        .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
        .map(([lifecycle, count]) => (
          <li
            key={lifecycle}
            className="inline-flex items-center gap-1 text-xs tabular-nums"
            title={lifecycle || 'no lifecycle'}
          >
            <LifecycleDot lifecycle={lifecycle} />
            {count}
            <span className="sr-only"> {lifecycle || 'no lifecycle'}</span>
          </li>
        ))}
    </ul>
  );
}

function withDocuments(rows: InteractionRow[]) {
  return rows.filter((r) => r.spec).length;
}

function Description({ text, missing }: { text: string; missing: string }) {
  return text ? (
    <p className="mb-6 max-w-prose text-sm leading-6">{text}</p>
  ) : (
    <p className="mb-6 text-sm text-muted-foreground">{missing}</p>
  );
}

/** Features grouped under their categories, with descriptions and interaction counts. */
function CatalogTable({
  reader,
  categories,
  showCategories = true,
}: {
  reader: Reader;
  categories: CategoryRow[];
  showCategories?: boolean;
}) {
  return (
    <div className="rounded-xl border">
      <Table className="md:table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="md:w-[30%]">Feature</TableHead>
            <TableHead className="hidden md:table-cell">Description</TableHead>
            <TableHead className="w-24 text-right">Interactions</TableHead>
            <TableHead className="w-28">Lifecycle</TableHead>
            <TableHead className="hidden w-40 xl:table-cell">Related UI</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <Fragment key={category.key}>
              {showCategories ? (
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={5} className="whitespace-normal py-2">
                    <Link
                      href={categoryHref(reader.routes, category.key)}
                      className="text-xs font-medium underline-offset-4 hover:underline"
                    >
                      <span className="mr-1.5 font-mono text-muted-foreground">{category.key}</span>
                      {category.title}
                    </Link>
                    {category.description ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {category.description}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ) : null}
              {category.features.length ? (
                category.features.map((feature) => (
                  <TableRow key={feature.id}>
                    <TableCell className="whitespace-normal align-top">
                      <Link
                        href={featureHref(reader.routes, feature.id)}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {feature.title}
                      </Link>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {feature.id}
                      </div>
                      {feature.description ? (
                        <p className="mt-1 text-xs text-muted-foreground md:hidden">
                          {feature.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden whitespace-normal align-top text-muted-foreground md:table-cell">
                      {feature.description ||
                        (feature.declared ? '—' : 'Not declared in the inventory')}
                    </TableCell>
                    <TableCell className="text-right align-top tabular-nums">
                      {feature.interactions.length}
                    </TableCell>
                    <TableCell className="align-top">
                      <LifecycleMix rows={feature.interactions} />
                    </TableCell>
                    <TableCell className="hidden align-top xl:table-cell">
                      {feature.relatedUi ? <Mono>{feature.relatedUi}</Mono> : '—'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-xs text-muted-foreground">
                    The inventory declares no features in this category.
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SectionHead({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-6">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

/** One category: its description, its features and every interaction under it. */
export function CategoryPage({
  reader,
  categoryKey,
  titleLevel = 1,
}: {
  reader: Reader;
  categoryKey: string;
  titleLevel?: 1 | 2;
}) {
  const index = reader.categories.findIndex((c) => c.key === categoryKey);
  const category = reader.categories[index];
  if (!category) return null;
  const link = (c: CategoryRow | undefined) =>
    c ? { href: categoryHref(reader.routes, c.key), title: c.title } : null;
  const rows = category.interactions;
  return (
    <ReaderLayout reader={reader}>
      <PageTitle
        eyebrow="Category"
        title={category.title}
        level={titleLevel}
        meta={
          <>
            <Mono>{category.key}</Mono>
            {category.declared ? null : <span>Not declared in the inventory</span>}
          </>
        }
      />
      <Description text={category.description} missing="The inventory gives no description." />
      <dl className={cn(STATS, 'grid-cols-2 sm:grid-cols-4')}>
        <Stat label="Features" value={category.features.length} />
        <Stat label="Interactions" value={rows.length} />
        <Stat label="With spec document" value={withDocuments(rows)} />
        <Stat
          label="Declared implementing"
          value={rows.filter((r) => r.lifecycle === 'implementing').length}
        />
      </dl>

      <section className="flex flex-col gap-3">
        <SectionHead title="Features">
          What this category delivers, one feature per row.
        </SectionHead>
        <CatalogTable reader={reader} categories={[category]} showCategories={false} />
      </section>

      <section className="mt-10 flex flex-col gap-3">
        <SectionHead title="Interactions">
          Every interaction the inventory declares here.
        </SectionHead>
        {rows.length ? (
          <InteractionTable
            rows={rows.map((r) => ({ ...r, href: specHref(reader.routes, r.id) }))}
          />
        ) : (
          <EmptyNotice>The inventory declares no interactions in this category yet.</EmptyNotice>
        )}
      </section>

      <AdjacentLinks
        label="Adjacent categories"
        previous={link(reader.categories[index - 1])}
        next={link(reader.categories[index + 1])}
      />
    </ReaderLayout>
  );
}

/** One feature: its description, category, related UI and interactions. */
export function FeaturePage({
  reader,
  featureId,
  titleLevel = 1,
}: {
  reader: Reader;
  featureId: string;
  titleLevel?: 1 | 2;
}) {
  const features = reader.categories.flatMap((c) => c.features);
  const index = features.findIndex((f) => f.id === featureId);
  const feature = features[index];
  if (!feature) return null;
  const link = (f: FeatureRow | undefined) =>
    f ? { href: featureHref(reader.routes, f.id), title: f.title } : null;
  const rows = feature.interactions;
  return (
    <ReaderLayout reader={reader}>
      <PageTitle
        eyebrow={
          <nav aria-label="Breadcrumb">
            <Link
              href={categoryHref(reader.routes, feature.categoryKey)}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              <span className="font-mono">{feature.categoryKey}</span> {feature.categoryTitle}
            </Link>
          </nav>
        }
        title={feature.title}
        level={titleLevel}
        meta={
          <>
            <Mono>{feature.id}</Mono>
            {feature.declared ? null : <span>Not declared in the inventory</span>}
          </>
        }
      />
      <Description text={feature.description} missing="The inventory gives no description." />
      <dl className="mb-8 grid grid-cols-2 divide-x divide-y rounded-xl border sm:grid-cols-4 [&>div]:border-border">
        <Property label="Interactions">{rows.length}</Property>
        <Property label="With spec document">{withDocuments(rows)}</Property>
        <Property label="Lifecycle" note="Declared in the inventory; not executed evidence.">
          <LifecycleMix rows={rows} />
        </Property>
        <Property label="Related UI">
          {feature.relatedUi ? <Mono>{feature.relatedUi}</Mono> : '—'}
        </Property>
      </dl>

      <section className="flex flex-col gap-3">
        <SectionHead title="Interactions">
          Every interaction the inventory declares for this feature.
        </SectionHead>
        {rows.length ? (
          <InteractionTable
            rows={rows.map((r) => ({ ...r, href: specHref(reader.routes, r.id) }))}
          />
        ) : (
          <EmptyNotice>The inventory declares no interactions for this feature yet.</EmptyNotice>
        )}
      </section>

      <AdjacentLinks
        label="Adjacent features"
        previous={link(features[index - 1])}
        next={link(features[index + 1])}
      />
    </ReaderLayout>
  );
}

/** Index: counts, the filterable interaction table and every other document. */
export function SpecIndex({ reader, empty }: { reader: Reader; empty: ReactNode }) {
  const { rows, result, routes } = reader;
  if (!rows.length && !result.model.documents.length) return <EmptyNotice>{empty}</EmptyNotice>;
  const inbound = new Map<string, number>();
  for (const r of result.model.relationships)
    if (r.kind === 'document_link') inbound.set(r.target, (inbound.get(r.target) ?? 0) + 1);
  // Contracts and flows first: they are what interaction specs link to most.
  const order = ['Contracts', 'Flows', 'Pages', 'Engineering', 'Rules', 'Reference', 'Overview'];
  const documentGroups = readerTree(reader.categories, result.model.documents, routes)
    .groups.map((g) => ({
      label: g.label,
      documents: g.documents.map((d) => ({ ...d, linkedFrom: inbound.get(d.path) ?? 0 })),
    }))
    .sort((x, y) => order.indexOf(x.label) - order.indexOf(y.label));
  const withDocument = rows.filter((r) => r.spec).length;
  const implementing = rows.filter((r) => r.lifecycle === 'implementing').length;
  const findingRows = rows.filter((r) => r.errors + r.warnings > 0).length;

  return (
    <ReaderLayout reader={reader}>
      <dl className={cn(STATS, 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6')}>
        <Stat label="Categories" value={reader.categories.length} href="#catalog" />
        <Stat
          label="Features"
          value={reader.categories.reduce((n, c) => n + c.features.length, 0)}
          href="#catalog"
        />
        <Stat label="Interactions" value={rows.length} />
        <Stat label="With spec document" value={withDocument} />
        <Stat label="Declared implementing" value={implementing} />
        <Stat
          label="With findings"
          value={
            findingRows ? <span className="text-destructive">{findingRows}</span> : findingRows
          }
        />
      </dl>

      {rows.length ? (
        <InteractionTable rows={rows.map((r) => ({ ...r, href: specHref(routes, r.id) }))} />
      ) : (
        <EmptyNotice>{empty}</EmptyNotice>
      )}

      <section className="mt-10 flex flex-col gap-3">
        <SectionHead id="catalog" title="Categories and features">
          How the inventory groups interactions, with each category's and feature's description.
        </SectionHead>
        {reader.categories.length ? (
          <CatalogTable reader={reader} categories={reader.categories} />
        ) : (
          <EmptyNotice>The inventory declares no categories or features.</EmptyNotice>
        )}
      </section>

      <section className="mt-10 flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium">Documents</h2>
          <p className="text-sm text-muted-foreground">
            Contracts, flows, page documents and references that interactions link to.
          </p>
        </div>
        {documentGroups.length ? (
          <DocumentTable groups={documentGroups} />
        ) : (
          <EmptyNotice>No documents besides interaction specs.</EmptyNotice>
        )}
      </section>
    </ReaderLayout>
  );
}
