import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadErrors, Mono, PageHead, Section, StatCard, StatusBadge } from '../../../components/dashboard.tsx';
import { loadDashboard } from '../../../lib/dashboard.ts';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: decodeURIComponent((await params).id) };
}

export default async function SpecPage({ params }: Props) {
  const id = decodeURIComponent((await params).id);
  const data = await loadDashboard();
  const spec = data.check?.specs.find((s) => s.id === id);
  if (!spec) notFound();
  const findings = data.check?.findings.filter((f) => f.path === spec.path) ?? [];
  const all = [data.overview, ...data.rules, ...data.contracts, ...data.flows].filter((d) => d !== null);
  const documents = new Map(all.map((d) => [d.path, d]));

  return (
    <>
      <Link href="/specs" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Specs
      </Link>
      <PageHead title={spec.title} description={<><Mono>{spec.id}</Mono> · <Mono>{spec.path}</Mono></>} />
      <LoadErrors errors={data.errors} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard title="Document status" value={<StatusBadge tone={spec.status === 'approved' ? 'ok' : 'neutral'}>{spec.status}</StatusBadge>} />
        <StatCard title="Implementation" value={<StatusBadge>Not tracked</StatusBadge>}>
          This spec format has no implementation status.
        </StatCard>
        <StatCard
          title="Structural check"
          value={<StatusBadge tone={findings.length ? 'bad' : 'ok'}>{findings.length ? `${findings.length} findings` : 'No findings'}</StatusBadge>}
        />
      </div>

      <Section title="Acceptance criteria">
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Criterion</TableHead>
                <TableHead className="w-28">Verification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spec.acceptance.map((statement, i) => (
                <TableRow key={statement}>
                  <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="whitespace-normal">{statement}</TableCell>
                  <TableCell><StatusBadge tone="planned">Not run</StatusBadge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Linked documents">
        <div className="flex flex-col gap-2">
          {spec.links.map((link) => {
            const doc = documents.get(`.spectrum/${link}`);
            return (
              <details key={link} className="group rounded-xl border bg-card">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                  <span className="font-medium">{doc?.title ?? link}</span>
                  <span className="font-mono text-xs text-muted-foreground">.spectrum/{link}</span>
                </summary>
                <div className="px-4 pb-4">
                  {doc ? <pre>{doc.body}</pre> : <p className="text-sm text-muted-foreground">Preview unavailable for this path.</p>}
                </div>
              </details>
            );
          })}
        </div>
      </Section>
    </>
  );
}
