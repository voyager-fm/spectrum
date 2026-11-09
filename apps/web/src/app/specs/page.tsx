import type { Metadata } from 'next';
import { EmptyNotice, LoadErrors, Mono, PageHead } from '../../components/dashboard.tsx';
import { createReader, SpecIndex } from '../../components/spec-reader.tsx';
import { loadDashboard } from '../../lib/dashboard.ts';

export const metadata: Metadata = { title: 'Specs' };

export default async function SpecsPage() {
  const data = await loadDashboard();
  return (
    <>
      <PageHead
        title="Specs"
        description="Every interaction the inventory declares, with its spec document, contracts and flows. Press ⌘K to search."
      />
      <LoadErrors errors={data.errors} />
      {data.check ? (
        <SpecIndex
          reader={createReader(data.check, { base: '/specs', query: '' })}
          empty={
            <>
              No interaction specs found. Run <Mono>pnpm spec:check</Mono> for details.
            </>
          }
        />
      ) : (
        <EmptyNotice>
          The repository could not be checked. Run <Mono>pnpm spec:check</Mono> for details.
        </EmptyNotice>
      )}
    </>
  );
}
