import type { Metadata } from 'next';
import { EmptyNotice, LoadErrors } from '../../../../../../components/dashboard.tsx';
import {
  RepositoryFrame,
  RevisionLine,
  repositoryPath,
  targetQuery,
} from '../../../../../../components/repository.tsx';
import { SpecGraphView } from '../../../../../../components/spec-graph.tsx';
import { createReader, ReaderLayout } from '../../../../../../components/spec-reader.tsx';
import { loadRepositoryCheck, parseTarget } from '../../../../../../lib/github.ts';
import { remoteRoutes } from '../../../../../../lib/reader.ts';
import { specGraph } from '../../../../../../lib/spec-graph.ts';

type Props = {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ ref?: string | string[]; pr?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Spec graph · ${decodeURIComponent(owner)}/${decodeURIComponent(repo)}` };
}

export default async function RemoteSpecGraphPage({ params, searchParams }: Props) {
  const { owner: rawOwner, repo: rawRepo } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);
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
  const graph = reader
    ? specGraph(reader.result, reader.rows, reader.categories, reader.routes)
    : null;

  return (
    <RepositoryFrame
      owner={owner}
      repo={repo}
      view={view}
      tab="specs"
      query={query}
      back={{ href: `${repositoryPath(owner, repo, 'specs')}${query}`, label: 'Specs' }}
      description="Interactions, features, categories and documents at one pinned commit, joined by the links, ownership and membership the specs declare. Lines show declared structure, not implementation."
    >
      {view.status === 'ready' && check && reader && graph ? (
        <>
          <div className="mb-6">
            <RevisionLine sha={check.sha} label={check.ref} htmlUrl={view.repository.htmlUrl} />
          </div>
          <ReaderLayout reader={reader}>
            {graph.nodes.length ? (
              <SpecGraphView graph={graph} />
            ) : (
              <EmptyNotice>This commit declares no interactions or documents to graph.</EmptyNotice>
            )}
          </ReaderLayout>
        </>
      ) : view.status === 'ready' ? (
        <>
          <LoadErrors errors={view.errors} />
          <EmptyNotice>Not assessed. No specs were read for this revision.</EmptyNotice>
        </>
      ) : null}
    </RepositoryFrame>
  );
}
