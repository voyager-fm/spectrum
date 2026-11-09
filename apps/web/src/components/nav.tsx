'use client';

import type { LucideIcon } from 'lucide-react';
import {
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
import { cn } from '@/lib/utils';

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  planned?: boolean;
}

const groups: { title: string; items: Item[] }[] = [
  {
    title: 'Specification',
    items: [
      { href: '/', label: 'Overview', icon: LayoutGrid },
      { href: '/specs', label: 'Specs', icon: FileText },
      { href: '/rules', label: 'Rules', icon: ScrollText },
    ],
  },
  {
    title: 'Agent loop',
    items: [
      { href: '/proposals', label: 'Proposals', icon: Inbox, planned: true },
      { href: '/runs', label: 'Runs', icon: Play, planned: true },
      { href: '/reviews', label: 'PR reviews', icon: GitPullRequest, planned: true },
    ],
  },
  {
    title: 'Repository',
    items: [
      { href: '/repositories', label: 'Repositories', icon: FolderGit2 },
      { href: '/settings', label: 'Integrations', icon: Plug },
    ],
  },
];

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <nav className="flex flex-col gap-5" aria-label="Dashboard">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-0.5">
          <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">{group.title}</div>
          {group.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/80 outline-none transition-colors',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                  active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.planned ? (
                  <span className="text-[11px] text-muted-foreground">Planned</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
