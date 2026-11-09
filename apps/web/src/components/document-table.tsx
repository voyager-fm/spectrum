'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface DocumentGroupRows {
  label: string;
  documents: { path: string; title: string; href: string; linkedFrom: number }[];
}

/** Non-interaction documents, one kind at a time, with how many documents link to each. */
export function DocumentTable({ groups }: { groups: DocumentGroupRows[] }) {
  const [label, setLabel] = useState(groups[0]?.label ?? '');
  const group = groups.find((g) => g.label === label) ?? groups[0];
  if (!group) return null;
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">Document kind</legend>
        {groups.map((g) => (
          <button
            key={g.label}
            type="button"
            aria-pressed={g.label === group.label}
            onClick={() => setLabel(g.label)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              g.label === group.label
                ? 'border-foreground bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {g.label}
            <span className="font-mono tabular-nums opacity-70">{g.documents.length}</span>
          </button>
        ))}
      </fieldset>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead className="hidden md:table-cell">Path</TableHead>
              <TableHead className="text-right">Linked from</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.documents.map((d) => (
              <TableRow key={d.path}>
                <TableCell className="whitespace-normal">
                  <Link href={d.href} className="font-medium underline-offset-4 hover:underline">
                    {d.title}
                  </Link>
                </TableCell>
                <TableCell className="hidden max-w-0 truncate font-mono text-[11px] text-muted-foreground md:table-cell">
                  <span title={d.path}>{d.path}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{d.linkedFrom}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
