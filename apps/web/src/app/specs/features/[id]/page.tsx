import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LoadErrors } from '../../../../components/dashboard.tsx';
import { createReader, FeaturePage } from '../../../../components/spec-reader.tsx';
import { loadDashboard } from '../../../../lib/dashboard.ts';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: decodeURIComponent((await params).id) };
}

export default async function SpecFeaturePage({ params }: Props) {
  const id = decodeURIComponent((await params).id);
  const data = await loadDashboard();
  if (!data.check) notFound();
  const reader = createReader(data.check, { base: '/specs', query: '' });
  if (!reader.categories.some((c) => c.features.some((f) => f.id === id))) notFound();
  return (
    <>
      <LoadErrors errors={data.errors} />
      <FeaturePage reader={reader} featureId={id} />
    </>
  );
}
