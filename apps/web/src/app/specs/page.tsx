import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  EmptyNotice,
  LoadErrors,
  Mono,
  PageHead,
  Section,
  StatusBadge,
} from '../../components/dashboard.tsx';
import { loadDashboard } from '../../lib/dashboard.ts';

export const metadata: Metadata = { title: 'Specs' };

export default async function SpecsPage() {
  const data = await loadDashboard();
  const specs = data.check?.specs ?? [];
  const shared = [...data.contracts, ...data.flows];
  return (
    <>
      <PageHead
        title="Specs"
        description={
          <>
            Interaction specs from the configured FI and Markdown sources, with their contracts and
            flows.
          </>
        }
      />
      <LoadErrors errors={data.errors} />

      {specs.length === 0 ? (
        <EmptyNotice>
          No interaction specs found. Run <Mono>pnpm spec:check</Mono> for details.
        </EmptyNotice>
      ) : (
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
                      href={`/specs/${encodeURIComponent(s.id)}`}
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
      )}

      <Section title="Shared contracts and flows">
        {shared.length === 0 ? (
          <EmptyNotice>No shared documents.</EmptyNotice>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {shared.map((d) => (
              <Card size="sm" key={d.path}>
                <CardHeader>
                  <CardTitle>{d.title}</CardTitle>
                  <CardDescription className="break-all font-mono text-xs">
                    {d.path}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Relationships">
        <p className="text-sm text-muted-foreground">
          {data.check?.model.inventories.length ?? '—'} configured inventories and{' '}
          {data.check?.model.relationships.length ?? '—'} resolved relationships connect objects,
          regions, features, interactions and their documents. These are structural links; semantic
          policy review and implementation verification require separate evidence.
        </p>
      </Section>
    </>
  );
}
