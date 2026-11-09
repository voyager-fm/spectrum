import { Waypoints } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyNotice, LoadErrors, Mono } from '../../../../../components/dashboard.tsx';
import {
  RepositoryFrame,
  RevisionLine,
  repositoryPath,
  targetQuery,
} from '../../../../../components/repository.tsx';
import { createReader, SpecIndex } from '../../../../../components/spec-reader.tsx';
import { loadRepositoryCheck, parseTarget } from '../../../../../lib/github.ts';
import { remoteRoutes } from '../../../../../lib/reader.ts';

type Props = {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ ref?: string | string[]; pr?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Specs · ${decodeURIComponent(owner)}/${decodeURIComponent(repo)}` };
}

export default async function RemoteSpecsPage({ params, searchParams }: Props) {
  const { owner: rawOwner, repo: rawRepo } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);
  const target = parseTarget(await searchParams);
  const view = await loadRepositoryCheck(owner, repo, target, undefined, { refs: false });
  const query = targetQuery(target);

  return (
    <RepositoryFrame
      owner={owner}
      repo={repo}
      view={view}
      tab="specs"
      query={query}
      description="Interaction specs read from .spectrum/ at one pinned commit. Press ⌘K to search."
    >
      {view.status === 'ready' ? (
        view.check ? (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <RevisionLine
                sha={view.check.sha}
                label={view.check.ref}
                htmlUrl={view.repository.htmlUrl}
              />
              <Link
                href={`${repositoryPath(owner, repo, 'specs')}/graph${query}`}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <Waypoints className="size-4" aria-hidden />
                Graph view
              </Link>
            </div>
            <SpecIndex
              reader={createReader(
                view.check.result,
                remoteRoutes(
                  repositoryPath(owner, repo, 'specs'),
                  query,
                  view.repository.htmlUrl,
                  view.check.sha,
                ),
              )}
              empty={
                view.check.result.config ? (
                  'This commit declares no interaction specs.'
                ) : (
                  <>
                    This commit has no readable <Mono>.spectrum/config.json</Mono>.{' '}
                    <Link
                      href={`${repositoryPath(owner, repo)}${query}`}
                      className="underline underline-offset-4"
                    >
                      Set up Spectrum
                    </Link>{' '}
                    to add specs.
                  </>
                )
              }
            />
          </>
        ) : (
          <>
            <LoadErrors errors={view.errors} />
            <EmptyNotice>Not assessed. No specs were read for this revision.</EmptyNotice>
          </>
        )
      ) : null}
    </RepositoryFrame>
  );
}
