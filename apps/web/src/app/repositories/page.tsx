import { ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AccountsMisconfigured, SignInPrompt } from '../../components/account.tsx';
import {
  EmptyNotice,
  LoadErrors,
  Mono,
  PageHead,
  Section,
  StatusBadge,
} from '../../components/dashboard.tsx';
import { GitHubSetup } from '../../components/github.tsx';
import { SkipButton } from '../../components/setup.tsx';
import { loadConnectedRepositories, parseRepositoryInput } from '../../lib/github.ts';
import { parseSkipped, REPOSITORIES_GUIDE, SKIP_COOKIE } from '../../lib/onboarding-skip.ts';
import { repositoryPath } from '../../lib/paths.ts';

export const metadata: Metadata = { title: 'Repositories' };

type Props = { searchParams: Promise<{ repository?: string | string[] }> };

export default async function RepositoriesPage({ searchParams }: Props) {
  const input = (await searchParams).repository;
  const typed = Array.isArray(input) ? input[0] : input;
  const parsed = typed ? parseRepositoryInput(typed) : null;
  if (parsed) redirect(repositoryPath(parsed.owner, parsed.repo));

  const data = await loadConnectedRepositories();
  const guideSkipped = parseSkipped((await cookies()).get(SKIP_COOKIE)?.value).has(
    REPOSITORIES_GUIDE,
  );
  return (
    <>
      <PageHead
        title="Repositories"
        description="GitHub repositories this server can read through the Spectrum GitHub App. Checks are read-only and run the deterministic spec check at one pinned commit."
      />
      {guideSkipped ? null : (
        <GettingStarted
          configured={data.status.configured}
          repositories={data.repositories.length}
          signedOut={data.viewer.mode === 'accounts' && !data.viewer.user}
        />
      )}
      {!data.status.configured ? (
        <GitHubSetup missing={data.status.missing} />
      ) : data.viewer.mode === 'misconfigured' ? (
        <AccountsMisconfigured missing={data.viewer.missing} />
      ) : data.viewer.mode === 'accounts' && !data.viewer.user ? (
        <SignInPrompt next="/repositories" />
      ) : (
        <>
          <LoadErrors errors={data.errors} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {data.installations.length} installation
              {data.installations.length === 1 ? '' : 's'}, {data.repositories.length}{' '}
              {data.repositories.length === 1 ? 'repository' : 'repositories'}
            </p>
            {data.status.installUrl ? (
              <a
                href={data.status.installUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Install or configure the App
                <ExternalLink aria-hidden />
              </a>
            ) : null}
          </div>
          <div className="mt-3">
            {data.repositories.length ? (
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repository</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead>Default branch</TableHead>
                      <TableHead>Installed on</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.repositories.map((r) => (
                      <TableRow key={r.fullName}>
                        <TableCell className="font-medium">
                          <Link
                            href={repositoryPath(r.owner, r.name)}
                            className="underline-offset-4 hover:underline"
                          >
                            {r.fullName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={r.private ? 'info' : 'neutral'}>
                            {r.private ? 'private' : 'public'}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <Mono>{r.defaultBranch}</Mono>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.account}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : data.errors.length ? null : (
              <EmptyNotice>
                The App has no repository access yet. Install it on an account and choose the
                repositories it may read.
              </EmptyNotice>
            )}
          </div>
        </>
      )}

      <Section
        title="Check a repository"
        description="Enter owner/name or a GitHub URL. Repositories without the App installed show an install step."
      >
        <form action="/repositories" method="get" className="flex max-w-md gap-2">
          <label htmlFor="repository" className="sr-only">
            Repository
          </label>
          <Input
            id="repository"
            name="repository"
            placeholder="owner/name"
            defaultValue={typed ?? ''}
            aria-invalid={typed ? true : undefined}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
          <button type="submit" className={buttonVariants({ variant: 'outline' })}>
            Open
          </button>
        </form>
        {typed ? (
          <p className="text-sm text-destructive">
            <Mono>{typed}</Mono> is not a repository name. Use owner/name.
          </p>
        ) : null}
      </Section>
    </>
  );
}

/** Where onboarding stands across the three steps a new user goes through. */
function GettingStarted({
  configured,
  repositories,
  signedOut,
}: {
  configured: boolean;
  repositories: number;
  /** Accounts are on and nobody is signed in: the count says nothing yet. */
  signedOut: boolean;
}) {
  const steps = [
    {
      title: 'Connect the GitHub App',
      done: configured,
      detail: configured
        ? 'This server can act as the Spectrum Specs Connector.'
        : 'Add the App credentials to this server.',
    },
    {
      title: 'Install it on repositories',
      done: configured && repositories > 0,
      detail:
        repositories > 0
          ? `${repositories} ${repositories === 1 ? 'repository is' : 'repositories are'} readable.`
          : signedOut
            ? 'Sign in to see the repositories you can access.'
            : 'Choose which repositories the App may read.',
    },
    {
      title: 'Set up Spectrum in each repository',
      done: false,
      detail: 'Open a repository to see what it still needs: CLI, configuration and agent skills.',
    },
  ];
  return (
    <div className="mb-8 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Getting started</h2>
        <SkipButton guide={REPOSITORIES_GUIDE} skipped>
          Skip for now
        </SkipButton>
      </div>
      <ol aria-label="Getting started" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-1 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">Step {index + 1}</span>
              {step.done ? <StatusBadge tone="ok">Done</StatusBadge> : null}
            </div>
            <span className="text-sm font-medium">{step.title}</span>
            <span className="text-sm text-muted-foreground">{step.detail}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
