'use client';

import { FileText, Search, SquareDashed } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { type SearchEntry, searchMatches } from '../lib/reader-query.ts';

function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/**
 * Command palette over spec IDs, titles, summaries, acceptance criteria and document paths.
 * Opens with ⌘K / Ctrl+K or `/` outside a text field.
 */
export function SpecSearch({ entries }: { entries: SearchEntry[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => searchMatches(entries, query), [entries, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const k = event.key.toLowerCase();
      if ((k === 'k' && (event.metaKey || event.ctrlKey)) || (k === '/' && !typing(event.target))) {
        event.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (entry: SearchEntry | undefined) => {
    if (!entry) return;
    setOpen(false);
    setQuery('');
    router.push(entry.href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Search className="size-3.5" aria-hidden />
        <span className="flex-1">Search specs</span>
        <kbd className="rounded border px-1 font-mono text-[10px]">⌘K</kbd>
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Search specs</DialogTitle>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, results.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  go(results[active]);
                }
              }}
              placeholder="ID, title, acceptance criterion or path"
              aria-label="Search specs"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {results.length ? (
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              className="max-h-96 overflow-y-auto p-1.5"
            >
              {results.map((entry, i) => {
                const Icon = entry.kind === 'interaction' ? FileText : SquareDashed;
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input handles keys.
                  <div
                    key={entry.href}
                    tabIndex={-1}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(entry)}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2',
                      i === active && 'bg-muted',
                    )}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium">{entry.title}</span>
                        {entry.id ? (
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                            {entry.id}
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{entry.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No spec or document matches “{query}”.
            </p>
          )}
          <div className="flex gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
            <span>↑↓ to move</span>
            <span>↵ to open</span>
            <span>esc to close</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
