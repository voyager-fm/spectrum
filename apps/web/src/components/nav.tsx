'use client';

import type { LucideIcon } from 'lucide-react';
import {
  ChevronRight,
  FileText,
  FolderGit2,
  GitPullRequest,
  Inbox,
  LayoutGrid,
  Play,
  Plug,
  ScrollText,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { specificationNav } from '../lib/paths.ts';

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}

/** Agent loop pages: placeholders until the agent loop runs, kept together in one compact group. */
const PLANNED = [
  { href: '/proposals', label: 'Proposals', icon: Inbox },
  { href: '/runs', label: 'Runs', icon: Play },
  { href: '/reviews', label: 'PR reviews', icon: GitPullRequest },
];

const linkClass = (active: boolean) =>
  cn(
    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/80 outline-none transition-colors',
    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring',
    active && 'bg-sidebar-primary/10 font-medium text-sidebar-primary hover:bg-sidebar-primary/15',
  );

function NavLink({ item }: { item: Item }) {
  return (
    <Link
      href={item.href}
      aria-current={item.active ? 'page' : undefined}
      className={linkClass(item.active)}
    >
      <item.icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

/**
 * Overview and Specs follow the repository selected in the switcher; Rules reads the local
 * repository's rule documents only, so it is listed while the local repository is selected.
 */
export function Nav() {
  const pathname = usePathname();
  const nav = specificationNav(pathname);
  const specification: Item[] = [
    { ...nav.overview, label: 'Overview', icon: LayoutGrid },
    { ...nav.specs, label: 'Specs', icon: FileText },
  ];
  if (nav.rules) specification.push({ ...nav.rules, label: 'Rules', icon: ScrollText });
  const repository: Item[] = [
    {
      href: '/repositories',
      label: 'Repositories',
      icon: FolderGit2,
      active: pathname === '/repositories',
    },
    {
      href: '/settings',
      label: 'Integrations',
      icon: Plug,
      active: pathname.startsWith('/settings'),
    },
  ];
  const plannedActive = PLANNED.some((p) => pathname.startsWith(p.href));

  return (
    <nav className="flex flex-col gap-5" aria-label="Dashboard">
      <Group title="Specification">
        {specification.map((item) => (
          <NavLink key={item.label} item={item} />
        ))}
      </Group>
      <Group title="Repository">
        {repository.map((item) => (
          <NavLink key={item.label} item={item} />
        ))}
      </Group>
      <details className="group/planned" open={plannedActive || undefined}>
        <summary
          className={cn(
            'flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground outline-none [&::-webkit-details-marker]:hidden',
            'hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          )}
        >
          <ChevronRight
            className="size-3.5 shrink-0 transition-transform group-open/planned:rotate-90"
            aria-hidden
          />
          <span className="flex-1">Agent loop</span>
          <span className="rounded border border-dashed px-1 text-[11px] font-normal">Planned</span>
        </summary>
        <div className="mt-0.5 flex flex-col gap-0.5">
          {PLANNED.map((p) => (
            <NavLink key={p.href} item={{ ...p, active: pathname.startsWith(p.href) }} />
          ))}
        </div>
      </details>
    </nav>
  );
}
