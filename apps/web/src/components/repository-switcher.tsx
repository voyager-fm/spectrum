'use client';

import {
  Check,
  ChevronsUpDown,
  FolderGit2,
  GitCommitHorizontal,
  Lock,
  LogIn,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SwitcherRepositories } from '../lib/github.ts';
import { localPath, repositoryContext, repositoryPath } from '../lib/paths.ts';

export interface LocalRepository {
  name: string;
  revision: string | null;
  dirty: boolean | null;
}

/**
 * Switch the dashboard between the local repository and connected GitHub repositories. The
 * current tab (overview or specs) carries over; the revision resets to the default branch.
 */
export function RepositorySwitcher({
  local,
  github,
}: {
  local: LocalRepository;
  github: SwitcherRepositories;
}) {
  const context = repositoryContext(usePathname());
  const currentRemote =
    context.kind === 'github' ? `${context.owner}/${context.repo}`.toLowerCase() : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2 rounded-lg border bg-background px-3 py-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        aria-label="Switch repository"
      >
        <span className="min-w-0 flex-1">
          {context.kind === 'github' ? (
            <>
              <span className="block truncate text-sm font-medium">
                {context.owner}/{context.repo}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FolderGit2 className="size-3.5" aria-hidden />
                GitHub
              </span>
            </>
          ) : (
            <>
              <span className="block truncate text-sm font-medium">{local.name}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GitCommitHorizontal className="size-3.5" aria-hidden />
                {local.revision ? (
                  <span className="font-mono">{local.revision.slice(0, 7)}</span>
                ) : (
                  'No Git revision'
                )}
                {local.dirty ? <span>· uncommitted</span> : null}
              </span>
            </>
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>This server</DropdownMenuLabel>
          <DropdownMenuItem render={<Link href={localPath(context.tab)} />}>
            <span className="min-w-0 flex-1 truncate">{local.name}</span>
            {context.kind === 'local' ? <Check aria-label="Current" /> : null}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>GitHub</DropdownMenuLabel>
          {github.configured && !github.signedIn ? (
            <DropdownMenuItem render={<a href="/sign-in" />}>
              <LogIn aria-hidden />
              Sign in to see repositories
            </DropdownMenuItem>
          ) : !github.configured ? (
            <DropdownMenuItem render={<Link href="/repositories" />}>
              <Plus aria-hidden />
              Connect GitHub
            </DropdownMenuItem>
          ) : (
            <>
              {github.repositories.map((r) => (
                <DropdownMenuItem
                  key={r.fullName}
                  render={<Link href={repositoryPath(r.owner, r.name, context.tab)} />}
                >
                  <span className="min-w-0 flex-1 truncate">{r.fullName}</span>
                  {r.private ? <Lock aria-label="Private" /> : null}
                  {currentRemote === r.fullName.toLowerCase() ? (
                    <Check aria-label="Current" />
                  ) : null}
                </DropdownMenuItem>
              ))}
              {github.unavailable ? (
                <DropdownMenuItem disabled>GitHub did not answer; list incomplete</DropdownMenuItem>
              ) : github.repositories.length === 0 ? (
                <DropdownMenuItem disabled>No repositories installed yet</DropdownMenuItem>
              ) : null}
            </>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/repositories" />}>
          <FolderGit2 aria-hidden />
          All repositories
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
