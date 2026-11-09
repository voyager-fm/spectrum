import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LoadErrors, Mono, PageHead } from '../../../components/dashboard.tsx';
import { SpecDetail } from '../../../components/specs.tsx';
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

  return (
    <>
      <Link
        href="/specs"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> Specs
      </Link>
      <PageHead
        title={spec.title}
        description={
          <>
            <Mono>{spec.id}</Mono> · <Mono className="break-all">{spec.path}</Mono>
          </>
        }
      />
      <LoadErrors errors={data.errors} />

      <SpecDetail
        spec={spec}
        findings={findings}
        documents={data.documents}
        checkOk={data.check?.ok}
      />
    </>
  );
}
