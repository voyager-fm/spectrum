'use client';

import { ChevronRight, ListFilter } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ReaderTree, TreeInteraction } from '../lib/reader.ts';
import type { SearchEntry } from '../lib/reader-query.ts';
import { SpecSearch } from './spec-search.tsx';

const pathOf = (href: string) => href.split(/[?#]/, 1)[0] ?? href;

/** Lifecycle marker, monotone: solid = implementing, ring = planned, dashed = idea. */
export function LifecycleDot({ lifecycle, className }: { lifecycle: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2 shrink-0 rounded-full border',
        lifecycle === 'implementing' || lifecycle === 'implemented'
          ? 'border-foreground bg-foreground'
          : lifecycle === 'planned'
            ? 'border-foreground'
            : 'border-dashed border-muted-foreground',
        className,
      )}
    />
  );
}

const FOCUS = 'outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * A collapsible tree group. With `href` the label is a link to the group's own page and only the
 * chevron toggles; without it the whole row toggles.
 */
function Group({
  label,
  name,
  meta,
  href,
  active = false,
  initiallyOpen,
  children,
}: {
  label: ReactNode;
  /** Plain-text name for the toggle's accessible label. */
  name: string;
  meta?: ReactNode;
  href?: string;
  active?: boolean;
  initiallyOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const chevron = (
    <ChevronRight
      className={cn(
        'size-3.5 shrink-0 text-muted-foreground transition-transform',
        open && 'rotate-90',
      )}
      aria-hidden
    />
  );
  const count = meta ? (
    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{meta}</span>
  ) : null;
  return (
    <li>
      {href ? (
        <div
          className={cn(
            'flex items-center rounded-md text-sm font-medium hover:bg-muted',
            active && 'bg-muted',
          )}
        >
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${name}`}
            onClick={() => setOpen((o) => !o)}
            className={cn('grid size-6 shrink-0 place-items-center rounded-md', FOCUS)}
          >
            {chevron}
          </button>
          <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn('flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1 pr-1.5', FOCUS)}
          >
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {count}
          </Link>
        </div>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm font-medium hover:bg-muted',
            FOCUS,
          )}
        >
          {chevron}
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {count}
        </button>
      )}
      {open ? <ul className="mt-0.5 mb-1.5 flex flex-col">{children}</ul> : null}
    </li>
  );
}

function Leaf({
  href,
  active,
  children,
  muted,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2 rounded-md py-1 pr-1.5 pl-6 text-[13px] outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
          active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground',
          muted && !active && 'text-muted-foreground/70',
        )}
      >
        {children}
      </Link>
    </li>
  );
}

function InteractionLeaf({ item, active }: { item: TreeInteraction; active: boolean }) {
  return (
    <Leaf href={item.href} active={active} muted={!item.hasSpec}>
      <LifecycleDot lifecycle={item.lifecycle} />
      <span className={cn('min-w-0 flex-1 truncate', !item.hasSpec && 'italic')}>{item.title}</span>
      {item.errors ? (
        <span
          className="size-1.5 shrink-0 rounded-full bg-destructive"
          role="img"
          aria-label="Has errors"
        />
      ) : null}
    </Leaf>
  );
}

/**
 * Left pane of the spec reader: search, the interaction tree and the other documents. Groups
 * that contain the open page start expanded.
 */
export function SpecNav({
  tree,
  search,
  indexHref,
}: {
  tree: ReaderTree;
  search: SearchEntry[];
  indexHref: string;
}) {
  const pathname = usePathname();
  // Below lg the tree is collapsed behind a toggle so the page starts with its content.
  const [expanded, setExpanded] = useState(false);
  const isActive = (href: string) => pathOf(href) === pathname;
  const interactionCount = tree.categories.reduce(
    (n, c) => n + c.features.reduce((m, f) => m + f.interactions.length, 0),
    0,
  );

  return (
    <nav aria-label="Specifications" className="flex flex-col gap-3">
      <SpecSearch entries={search} />
      <Link
        href={indexHref}
        aria-current={isActive(indexHref) ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
          isActive(indexHref) ? 'bg-muted font-medium' : 'text-muted-foreground',
        )}
      >
        <ListFilter className="size-3.5" aria-hidden />
        <span className="flex-1">All interactions</span>
        <span className="font-mono text-[11px] tabular-nums">{interactionCount}</span>
      </Link>

      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
      >
        <ChevronRight
          className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
          aria-hidden
        />
        {expanded ? 'Hide spec tree' : 'Browse spec tree'}
      </button>

      <ul className={cn('flex flex-col', !expanded && 'max-lg:hidden')}>
        {tree.categories.map((category) => {
          const items = category.features.flatMap((f) => f.interactions);
          const categoryActive = isActive(category.href);
          return (
            <Group
              key={category.key}
              name={category.title}
              href={category.href}
              active={categoryActive}
              label={
                <>
                  <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">
                    {category.key}
                  </span>
                  {category.title}
                </>
              }
              meta={items.length}
              initiallyOpen={
                categoryActive ||
                category.features.some((f) => isActive(f.href)) ||
                items.some((i) => isActive(i.href))
              }
            >
              {category.features.map((feature) => (
                <li key={feature.id} className="mt-1 first:mt-0">
                  <Link
                    href={feature.href}
                    aria-current={isActive(feature.href) ? 'page' : undefined}
                    className={cn(
                      'block truncate rounded-md py-0.5 pr-1.5 pl-6 text-[11px] hover:bg-muted hover:text-foreground',
                      FOCUS,
                      isActive(feature.href)
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    <span className="font-mono">{feature.id}</span> · {feature.title}
                  </Link>
                  <ul className="flex flex-col">
                    {feature.interactions.map((item) => (
                      <InteractionLeaf key={item.id} item={item} active={isActive(item.href)} />
                    ))}
                  </ul>
                </li>
              ))}
            </Group>
          );
        })}
      </ul>

      {tree.groups.length ? (
        <ul className={cn('flex flex-col border-t pt-3', !expanded && 'max-lg:hidden')}>
          {tree.groups.map((group) => (
            <Group
              key={group.label}
              name={group.label}
              label={group.label}
              meta={group.documents.length}
              initiallyOpen={group.documents.some((d) => isActive(d.href))}
            >
              {group.documents.map((doc) => (
                <Leaf key={doc.path} href={doc.href} active={isActive(doc.href)}>
                  <span className="min-w-0 flex-1 truncate" title={doc.path}>
                    {doc.title}
                  </span>
                </Leaf>
              ))}
            </Group>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}
