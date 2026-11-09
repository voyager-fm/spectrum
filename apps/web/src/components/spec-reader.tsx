import type { CheckResult, Finding, RepositoryDocument, Spec } from '@spectrum/core';
import { markdownView } from '@spectrum/spec-engine/markdown';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
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
  links: LinkContext;
}

export function createReader(result: CheckResult, routes: ReaderRoutes): Reader {
  return { result, routes, rows: interactionRows(result), links: linkContext(result, routes) };
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
          tree={readerTree(reader.rows, reader.result.model.documents, reader.routes)}
          search={searchEntries(reader.rows, reader.result, reader.routes)}
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
  if (!previous && !next) return null;
  const card = 'flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl border px-4 py-3 hover:bg-muted/50';
  return (
    <nav aria-label="Adjacent specs" className="mt-12 flex gap-3">
      {previous ? (
        <Link href={specHref(reader.routes, previous.id)} className={card}>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ChevronLeft className="size-3.5" aria-hidden /> Previous
          </span>
          <span className="truncate text-sm font-medium">{previous.title}</span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
      {next ? (
        <Link href={specHref(reader.routes, next.id)} className={cn(card, 'items-end text-right')}>
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
          <>
            <span className="font-mono">{row.categoryKey}</span> {row.categoryTitle}
            <ChevronRight className="mx-1 inline size-3 align-middle" aria-hidden />
            <span className="font-mono">{row.featureId}</span> {row.featureTitle}
          </>
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

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
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
  const documentGroups = readerTree(rows, result.model.documents, routes)
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
      <dl className="mb-6 grid grid-cols-2 divide-x rounded-xl border sm:grid-cols-4 max-sm:[&>div:nth-child(n+3)]:border-t">
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
