import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LoadErrors } from '../../../../components/dashboard.tsx';
import { createReader, DocumentPage } from '../../../../components/spec-reader.tsx';
import { loadDashboard } from '../../../../lib/dashboard.ts';

type Props = { params: Promise<{ path: string[] }> };

const repositoryPath = (segments: string[]) => segments.map(decodeURIComponent).join('/');

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const path = repositoryPath((await params).path);
  return { title: path.split('/').at(-1) ?? path };
}

export default async function SpecDocumentPage({ params }: Props) {
  const path = repositoryPath((await params).path);
  const data = await loadDashboard();
  if (!data.check?.model.documents.some((d) => d.path === path)) notFound();
  return (
    <>
      <LoadErrors errors={data.errors} />
      <DocumentPage reader={createReader(data.check, { base: '/specs', query: '' })} path={path} />
    </>
  );
}
