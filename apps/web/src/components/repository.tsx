import { ChevronLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CheckTarget, RepositoryView } from '../lib/github.ts';
import { type RepositoryTab, repositoryPath } from '../lib/paths.ts';
import { EmptyNotice, LoadErrors, Mono, PageHead } from './dashboard.tsx';
import { GitHubSetup } from './github.tsx';

export { repositoryPath };

/** The query that selects the same revision on another page; empty for the default branch. */
export function targetQuery(target: CheckTarget | { kind: 'invalid' }): string {
  if (target.kind === 'pr') return `?pr=${target.number}`;
  if (target.kind === 'ref') return `?ref=${encodeURIComponent(target.ref)}`;
  return '';
}

const DESCRIPTION =
  'Deterministic structural check of .spectrum/ at one pinned commit. No model runs; this is not a code review.';

/**
 * Header, tabs and every state where the repository cannot be shown. Children render only when
 * the repository is ready.
 */
export function RepositoryFrame({
  owner,
  repo,
  view,
  tab,
  query,
  title,
  description = DESCRIPTION,
  back,
  children,
}: {
  owner: string;
  repo: string;
  view: RepositoryView;
  tab: RepositoryTab;
  query: string;
  title?: string;
  description?: ReactNode;
  back?: { href: string; label: string };
  children: ReactNode;
}) {
  const backLink = back ?? { href: '/repositories', label: 'Repositories' };
  const head = (
    <>
      <Link
        href={backLink.href}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {backLink.label}
      </Link>
      <PageHead title={title ?? `${owner}/${repo}`} description={description} />
    </>
  );

  if (view.status === 'not-configured') {
    return (
      <>
        {head}
        <GitHubSetup missing={view.app.missing} />
      </>
    );
  }
  if (view.status === 'invalid') {
    return (
      <>
        {head}
        <EmptyNotice>{view.message}</EmptyNotice>
      </>
    );
  }
  if (view.status === 'not-installed') {
    return (
      <>
        {head}
        <section className="rounded-xl border p-6">
          <h2 className="text-sm font-medium">The Spectrum App is not installed here</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            GitHub reports no installation that covers <Mono>{view.fullName}</Mono>, or the
            repository does not exist. Nothing was checked.
          </p>
          {view.app.installUrl ? (
            <a
              href={view.app.installUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-4' })}
            >
              Install the App
              <ExternalLink aria-hidden />
            </a>
          ) : null}
        </section>
      </>
    );
  }
  if (view.status === 'error') {
    return (
      <>
        {head}
        <LoadErrors errors={view.errors} />
      </>
    );
  }
  return (
    <>
      {head}
      <RepositoryTabs owner={owner} repo={repo} active={tab} query={query} />
      {children}
    </>
  );
}

function RepositoryTabs({
  owner,
  repo,
  active,
  query,
}: {
  owner: string;
  repo: string;
  active: RepositoryTab;
  query: string;
}) {
  const tabs: { key: RepositoryTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'specs', label: 'Specs' },
  ];
  return (
    <nav aria-label="Repository" className="-mt-4 mb-6 flex gap-1 border-b">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`${repositoryPath(owner, repo, t.key)}${query}`}
          aria-current={t.key === active ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground',
            t.key === active
              ? 'border-foreground font-medium text-foreground'
              : 'border-transparent',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Pinned revision line shared by the repository pages. */
export function RevisionLine({
  sha,
  label,
  htmlUrl,
}: {
  sha: string;
  label: string;
  htmlUrl: string;
}) {
  return (
    <p className="text-sm text-muted-foreground">
      At{' '}
      <a
        href={`${htmlUrl}/commit/${sha}`}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-foreground underline-offset-4 hover:underline"
      >
        {sha.slice(0, 7)}
      </a>{' '}
      from <Mono>{label}</Mono>
    </p>
  );
}
