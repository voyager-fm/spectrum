import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyNotice, LoadErrors } from '../../../../../../../components/dashboard.tsx';
import {
  RepositoryFrame,
  RevisionLine,
  repositoryPath,
  targetQuery,
} from '../../../../../../../components/repository.tsx';
import { createReader, DocumentPage } from '../../../../../../../components/spec-reader.tsx';
import { loadRepositoryCheck, parseTarget } from '../../../../../../../lib/github.ts';
import { remoteRoutes } from '../../../../../../../lib/reader.ts';

type Props = {
  params: Promise<{ owner: string; repo: string; path: string[] }>;
  searchParams: Promise<{ ref?: string | string[]; pr?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { repo, path } = await params;
  return { title: `${decodeURIComponent(path.at(-1) ?? '')} · ${decodeURIComponent(repo)}` };
}

export default async function RemoteDocumentPage({ params, searchParams }: Props) {
  const { owner: rawOwner, repo: rawRepo, path: rawPath } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);
  const path = rawPath.map(decodeURIComponent).join('/');
  const target = parseTarget(await searchParams);
  const view = await loadRepositoryCheck(owner, repo, target, undefined, { refs: false });
  const query = targetQuery(target);
  const check = view.status === 'ready' ? view.check : null;
  const reader =
    view.status === 'ready' && check
      ? createReader(
          check.result,
          remoteRoutes(
            repositoryPath(owner, repo, 'specs'),
            query,
            view.repository.htmlUrl,
            check.sha,
          ),
        )
      : null;
  // A document that the pinned commit does not contain is a missing page, not an empty one.
  if (reader && !check?.result.model.documents.some((d) => d.path === path)) notFound();

  return (
    <RepositoryFrame owner={owner} repo={repo} view={view} tab="specs" query={query}>
      {view.status === 'ready' && check && reader ? (
        <>
          <div className="mb-6">
            <RevisionLine sha={check.sha} label={check.ref} htmlUrl={view.repository.htmlUrl} />
          </div>
          <DocumentPage reader={reader} path={path} titleLevel={2} />
        </>
      ) : view.status === 'ready' ? (
        <>
          <LoadErrors errors={view.errors} />
          <EmptyNotice>Not assessed. The document could not be read at this revision.</EmptyNotice>
        </>
      ) : null}
    </RepositoryFrame>
  );
}
