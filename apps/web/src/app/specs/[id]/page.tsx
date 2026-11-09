import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LoadErrors } from '../../../components/dashboard.tsx';
import { createReader, SpecPage } from '../../../components/spec-reader.tsx';
import { loadDashboard } from '../../../lib/dashboard.ts';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: decodeURIComponent((await params).id) };
}

export default async function SpecDetailPage({ params }: Props) {
  const id = decodeURIComponent((await params).id);
  const data = await loadDashboard();
  if (!data.check) notFound();
  const reader = createReader(data.check, { base: '/specs', query: '' });
  if (!reader.rows.some((r) => r.id === id)) notFound();
  return (
    <>
      <LoadErrors errors={data.errors} />
      <SpecPage reader={reader} id={id} />
    </>
  );
}
