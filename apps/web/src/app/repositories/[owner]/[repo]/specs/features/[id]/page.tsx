import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyNotice, LoadErrors } from '../../../../../../../components/dashboard.tsx';
import {
  RepositoryFrame,
  RevisionLine,
  repositoryPath,
  targetQuery,
} from '../../../../../../../components/repository.tsx';
import { createReader, FeaturePage } from '../../../../../../../components/spec-reader.tsx';
import { loadRepositoryCheck, parseTarget } from '../../../../../../../lib/github.ts';
import { remoteRoutes } from '../../../../../../../lib/reader.ts';

type Props = {
  params: Promise<{ owner: string; repo: string; id: string }>;
  searchParams: Promise<{ ref?: string | string[]; pr?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { repo, id } = await params;
  return { title: `${decodeURIComponent(id)} · ${decodeURIComponent(repo)}` };
}

export default async function RemoteFeaturePage({ params, searchParams }: Props) {
  const { owner: rawOwner, repo: rawRepo, id: raw } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);
  const id = decodeURIComponent(raw);
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
  // A feature that the pinned commit does not declare is a missing page, not an empty one.
  if (reader && !reader.categories.some((c) => c.features.some((f) => f.id === id))) notFound();

  return (
    <RepositoryFrame owner={owner} repo={repo} view={view} tab="specs" query={query}>
      {view.status === 'ready' && check && reader ? (
        <>
          <div className="mb-6">
            <RevisionLine sha={check.sha} label={check.ref} htmlUrl={view.repository.htmlUrl} />
          </div>
          <FeaturePage reader={reader} featureId={id} titleLevel={2} />
        </>
      ) : view.status === 'ready' ? (
        <>
          <LoadErrors errors={view.errors} />
          <EmptyNotice>Not assessed. The feature could not be read at this revision.</EmptyNotice>
        </>
      ) : null}
    </RepositoryFrame>
  );
}
