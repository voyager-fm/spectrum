import type { Metadata } from 'next';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyNotice, LoadErrors, Mono, PageHead, Section } from '../../components/dashboard.tsx';
import { SpecTable } from '../../components/specs.tsx';
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

      <SpecTable
        specs={specs}
        hrefFor={(s) => `/specs/${encodeURIComponent(s.id)}`}
        empty={
          <>
            No interaction specs found. Run <Mono>pnpm spec:check</Mono> for details.
          </>
        }
      />

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
