import { ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
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
import {
  EmptyNotice,
  LoadErrors,
  Mono,
  PageHead,
  Section,
  StatusBadge,
} from '../../components/dashboard.tsx';
import { GitHubSetup } from '../../components/github.tsx';
import { loadConnectedRepositories, parseRepositoryInput } from '../../lib/github.ts';

export const metadata: Metadata = { title: 'Repositories' };

type Props = { searchParams: Promise<{ repository?: string | string[] }> };

export default async function RepositoriesPage({ searchParams }: Props) {
  const input = (await searchParams).repository;
  const typed = Array.isArray(input) ? input[0] : input;
  const parsed = typed ? parseRepositoryInput(typed) : null;
  if (parsed) redirect(`/repositories/${parsed.owner}/${parsed.repo}`);

  const data = await loadConnectedRepositories();
  return (
    <>
      <PageHead
        title="Repositories"
        description="GitHub repositories this server can read through the Spectrum GitHub App. Checks are read-only and run the deterministic spec check at one pinned commit."
      />
      {!data.status.configured ? (
        <GitHubSetup missing={data.status.missing} />
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
                            href={`/repositories/${r.owner}/${r.name}`}
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
