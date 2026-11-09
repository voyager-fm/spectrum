import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyNotice, LoadErrors, Mono, Section } from '../../../../../components/dashboard.tsx';
import {
  RepositoryFrame,
  RevisionLine,
  repositoryPath,
  targetQuery,
} from '../../../../../components/repository.tsx';
import { SpecTable } from '../../../../../components/specs.tsx';
import { loadRepositoryCheck, parseTarget, type RemoteCheck } from '../../../../../lib/github.ts';

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
      description="Interaction specs read from .spectrum/ at one pinned commit."
    >
      {view.status === 'ready' ? (
        view.check ? (
          <>
            <div className="mb-6">
              <RevisionLine
                sha={view.check.sha}
                label={view.check.ref}
                htmlUrl={view.repository.htmlUrl}
              />
            </div>
            <SpecTable
              specs={view.check.result.specs}
              hrefFor={(s) =>
                `${repositoryPath(owner, repo, 'specs')}/${encodeURIComponent(s.id)}${query}`
              }
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
            <SharedDocuments check={view.check} />
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

function SharedDocuments({ check }: { check: RemoteCheck }) {
  const shared = check.result.model.documents.filter(
    (d) => d.kind === 'contract' || d.kind === 'page_contract' || d.kind === 'flow',
  );
  return (
    <Section title="Shared contracts and flows">
      {shared.length ? (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {shared.map((d) => (
            <li key={d.path} className="rounded-xl border px-4 py-3">
              <div className="text-sm font-medium">{d.title}</div>
              <div className="break-all font-mono text-xs text-muted-foreground">{d.path}</div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyNotice>No shared documents.</EmptyNotice>
      )}
    </Section>
  );
}
