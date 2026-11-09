import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LoadErrors } from '../../../../components/dashboard.tsx';
import { CategoryPage, createReader } from '../../../../components/spec-reader.tsx';
import { loadDashboard } from '../../../../lib/dashboard.ts';

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: decodeURIComponent((await params).key) };
}

export default async function SpecCategoryPage({ params }: Props) {
  const key = decodeURIComponent((await params).key);
  const data = await loadDashboard();
  if (!data.check) notFound();
  const reader = createReader(data.check, { base: '/specs', query: '' });
  if (!reader.categories.some((c) => c.key === key)) notFound();
  return (
    <>
      <LoadErrors errors={data.errors} />
      <CategoryPage reader={reader} categoryKey={key} />
    </>
  );
}
