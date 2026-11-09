import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyNotice, LoadErrors, Mono } from '../../../../../../components/dashboard.tsx';
import {
  RepositoryFrame,
  RevisionLine,
  repositoryPath,
  targetQuery,
} from '../../../../../../components/repository.tsx';
import { SourceLink, SpecDetail } from '../../../../../../components/specs.tsx';
import { loadRepositoryCheck, parseTarget } from '../../../../../../lib/github.ts';

type Props = {
  params: Promise<{ owner: string; repo: string; id: string }>;
  searchParams: Promise<{ ref?: string | string[]; pr?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { repo, id } = await params;
  return { title: `${decodeURIComponent(id)} · ${decodeURIComponent(repo)}` };
}

export default async function RemoteSpecPage({ params, searchParams }: Props) {
  const { owner: rawOwner, repo: rawRepo, id: rawId } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);
  const id = decodeURIComponent(rawId);
  const target = parseTarget(await searchParams);
  const view = await loadRepositoryCheck(owner, repo, target, undefined, { refs: false });
  const query = targetQuery(target);
  const check = view.status === 'ready' ? view.check : null;
  const spec = check?.result.specs.find((s) => s.id === id);
  // A spec that the pinned commit does not contain is a missing page, not an empty one.
  if (check && !spec) notFound();

  return (
    <RepositoryFrame
      owner={owner}
      repo={repo}
      view={view}
      tab="specs"
      query={query}
      title={spec?.title ?? id}
      description={
        spec ? (
          <>
            <Mono>{spec.id}</Mono> · <Mono className="break-all">{spec.path}</Mono>
          </>
        ) : (
          <Mono>{id}</Mono>
        )
      }
      back={{ href: `${repositoryPath(owner, repo, 'specs')}${query}`, label: 'Specs' }}
    >
      {view.status === 'ready' && check && spec ? (
        <>
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
            <RevisionLine sha={check.sha} label={check.ref} htmlUrl={view.repository.htmlUrl} />
            <SourceLink href={`${view.repository.htmlUrl}/blob/${check.sha}/${spec.path}`} />
          </div>
          <SpecDetail
            spec={spec}
            findings={check.result.findings.filter((f) => f.path === spec.path)}
            documents={check.result.model.documents}
            checkOk={check.result.ok}
            sourceUrl={(path) => `${view.repository.htmlUrl}/blob/${check.sha}/${path}`}
          />
        </>
      ) : view.status === 'ready' ? (
        <>
          <LoadErrors errors={view.errors} />
          <EmptyNotice>Not assessed. The spec could not be read at this revision.</EmptyNotice>
        </>
      ) : null}
    </RepositoryFrame>
  );
}
