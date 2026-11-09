import type { Finding, RepositoryDocument, Spec } from '@spectrum/core';
import { ChevronRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyNotice, Mono, Section, StatCard, StatusBadge } from './dashboard.tsx';

/** Interaction specs as a table. The caller decides where each row links. */
export function SpecTable({
  specs,
  hrefFor,
  empty,
}: {
  specs: Spec[];
  hrefFor: (spec: Spec) => string;
  empty: React.ReactNode;
}) {
  if (specs.length === 0) return <EmptyNotice>{empty}</EmptyNotice>;
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Document status</TableHead>
            <TableHead className="text-right">Acceptance criteria</TableHead>
            <TableHead className="text-right">Links</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {specs.map((s) => (
            <TableRow key={s.path}>
              <TableCell>
                <Link
                  href={hrefFor(s)}
                  className="font-mono text-xs font-medium underline-offset-4 hover:underline"
                >
                  {s.id}
                </Link>
              </TableCell>
              <TableCell className="whitespace-normal">{s.title}</TableCell>
              <TableCell>
                <StatusBadge tone="neutral">{s.status}</StatusBadge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{s.acceptance.length}</TableCell>
              <TableCell className="text-right tabular-nums">{s.links.length}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * One spec's status, acceptance criteria and linked documents. `sourceUrl` turns a repository
 * path into a link to the exact revision the spec was read from.
 */
export function SpecDetail({
  spec,
  findings,
  documents,
  checkOk,
  sourceUrl,
}: {
  spec: Spec;
  findings: Finding[];
  documents: Pick<RepositoryDocument, 'path' | 'title' | 'body'>[];
  checkOk: boolean | undefined;
  sourceUrl?: (path: string) => string;
}) {
  const byPath = new Map(documents.map((d) => [d.path, d]));
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          title="Document status"
          value={<StatusBadge tone="neutral">{spec.status}</StatusBadge>}
        />
        <StatCard
          title="Declared lifecycle"
          value={<StatusBadge>{spec.implementationStatus}</StatusBadge>}
        >
          Phase: {spec.phase}. This inventory value is not executed test evidence.
        </StatCard>
        <StatCard
          title="Structural check"
          value={
            <StatusBadge tone={findings.length ? 'bad' : checkOk ? 'ok' : 'neutral'}>
              {findings.length
                ? `${findings.length} findings`
                : checkOk
                  ? 'No findings'
                  : 'Repository needs review'}
            </StatusBadge>
          }
        />
      </div>

      {findings.length ? (
        <Section title="Findings for this spec">
          <ul className="flex flex-col gap-2 text-sm">
            {findings.map((f) => (
              <li
                key={`${f.code}:${f.line ?? ''}:${f.message}`}
                className="flex flex-wrap items-baseline gap-2"
              >
                <StatusBadge tone={f.severity === 'error' ? 'bad' : 'neutral'}>
                  {f.severity}
                </StatusBadge>
                <Mono>{f.code}</Mono>
                <span className="text-muted-foreground">{f.message}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Acceptance criteria">
        {spec.acceptance.length ? (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">ID</TableHead>
                  <TableHead>Criterion</TableHead>
                  <TableHead className="w-28">Verification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spec.acceptance.map((criterion) => (
                  <TableRow key={`${criterion.id ?? 'unassigned'}:${criterion.statement}`}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {criterion.id ?? 'Unassigned'}
                    </TableCell>
                    <TableCell className="whitespace-normal">{criterion.statement}</TableCell>
                    <TableCell>
                      <StatusBadge tone="planned">Not recorded</StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyNotice>This spec lists no acceptance criteria.</EmptyNotice>
        )}
      </Section>

      <Section title="Linked documents">
        {spec.links.length ? (
          <div className="flex flex-col gap-2">
            {spec.links.map((link) => {
              const doc = byPath.get(link);
              return (
                <details key={link} className="group rounded-xl border bg-card">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                    <ChevronRight
                      className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
                      aria-hidden
                    />
                    <span className="min-w-0 break-words font-medium">{doc?.title ?? link}</span>
                    <span className="min-w-0 break-all font-mono text-xs text-muted-foreground">
                      {link}
                    </span>
                  </summary>
                  <div className="flex flex-col gap-3 px-4 pb-4">
                    {doc ? (
                      <pre>{doc.body}</pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Preview unavailable for this path.
                      </p>
                    )}
                    {sourceUrl ? <SourceLink href={sourceUrl(link)} /> : null}
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <EmptyNotice>This spec links no documents.</EmptyNotice>
        )}
      </Section>
    </>
  );
}

export function SourceLink({ href, label = 'View on GitHub' }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {label}
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}
