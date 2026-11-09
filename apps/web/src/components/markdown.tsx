import type { MarkdownBlock, MarkdownInline } from '@spectrum/spec-engine/markdown';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { ResolvedLink } from '../lib/reader.ts';

type Resolve = (href: string) => ResolvedLink;

/**
 * Renders a repository document's Markdown as React elements. Content is text only (see
 * `markdownView`), so untrusted repository files cannot inject markup. `replace` lets a page
 * swap one section's body, such as acceptance criteria, for a dedicated component.
 */
export function Markdown({
  blocks,
  resolve,
  replace,
  skipTitle = false,
}: {
  blocks: MarkdownBlock[];
  resolve: Resolve;
  replace?: Record<string, ReactNode>;
  skipTitle?: boolean;
}) {
  const out: ReactNode[] = [];
  let replacing = false;
  let titleSkipped = !skipTitle;
  for (const [index, block] of blocks.entries()) {
    if (block.type === 'heading') {
      if (!titleSkipped && block.depth === 1) {
        titleSkipped = true;
        continue;
      }
      if (block.depth <= 2) replacing = false;
      const replacement = block.depth === 2 ? replace?.[block.text] : undefined;
      out.push(<Block key={index} block={block} resolve={resolve} />);
      if (replacement !== undefined) {
        out.push(<div key={`${index}-replacement`}>{replacement}</div>);
        replacing = true;
      }
      continue;
    }
    if (replacing) continue;
    out.push(<Block key={index} block={block} resolve={resolve} />);
  }
  return <div className="flex flex-col gap-4 text-sm leading-6">{out}</div>;
}

const HEADING_CLASS: Record<number, string> = {
  1: 'text-xl font-semibold tracking-tight',
  2: 'mt-6 border-b pb-2 text-base font-semibold first:mt-0',
  3: 'mt-2 text-sm font-semibold',
};

function Block({ block, resolve }: { block: MarkdownBlock; resolve: Resolve }): ReactNode {
  switch (block.type) {
    case 'heading': {
      // The page title is the only h1; document headings start at h2.
      const Tag = `h${Math.max(2, block.depth)}` as 'h2';
      return (
        <Tag
          id={block.slug}
          className={cn('scroll-mt-6', HEADING_CLASS[block.depth] ?? 'text-sm font-medium')}
        >
          <Inline nodes={block.children} resolve={resolve} />
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p className="whitespace-pre-line break-words">
          <Inline nodes={block.children} resolve={resolve} />
        </p>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag
          start={block.start ?? undefined}
          className={cn('flex flex-col gap-1.5 pl-5', block.ordered ? 'list-decimal' : 'list-disc')}
        >
          {block.items.map((item, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: list items have no stable identity.
              key={i}
              className={cn(item.task && 'list-none -ml-5 flex gap-2')}
            >
              {item.task ? (
                <span
                  className="mt-1 grid size-3.5 shrink-0 place-items-center rounded-sm border text-[10px] leading-none text-muted-foreground"
                  role="img"
                  aria-label={
                    item.checked ? 'Checked in the document' : 'Unchecked in the document'
                  }
                >
                  {item.checked ? '✓' : ''}
                </span>
              ) : null}
              <div className="flex min-w-0 flex-col gap-2">
                {item.children.map((child, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: nested blocks have no stable identity.
                  <Block key={j} block={child} resolve={resolve} />
                ))}
              </div>
            </li>
          ))}
        </Tag>
      );
    }
    case 'code':
      return <CodeBlock text={block.text} label={block.lang || undefined} />;
    case 'blockquote':
      return (
        <blockquote className="flex flex-col gap-2 border-l-2 pl-4 text-muted-foreground">
          {block.children.map((child, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: nested blocks have no stable identity.
            <Block key={i} block={child} resolve={resolve} />
          ))}
        </blockquote>
      );
    case 'table':
      return (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="border-b">
              <tr>
                {block.header.map((cell, i) => (
                  <th
                    // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional.
                    key={i}
                    className="px-3 py-2 font-medium"
                    style={{ textAlign: block.align[i] ?? undefined }}
                  >
                    <Inline nodes={cell} resolve={resolve} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional.
                <tr key={r} className="border-b last:border-0">
                  {row.map((cell, i) => (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional.
                      key={i}
                      className="px-3 py-2 align-top"
                      style={{ textAlign: block.align[i] ?? undefined }}
                    >
                      <Inline nodes={cell} resolve={resolve} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'rule':
      return <hr className="border-border" />;
  }
}

export function CodeBlock({ text, label }: { text: string; label?: string }) {
  const lines = text.replace(/\n$/, '').split('\n');
  return (
    <div className="overflow-hidden rounded-xl border bg-muted/40">
      {label ? (
        <div className="border-b px-3 py-1.5 font-mono text-xs text-muted-foreground">{label}</div>
      ) : null}
      <pre className="py-2 font-mono text-xs leading-5">
        <code className="grid">
          {lines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional.
            <span key={i} id={`L${i + 1}`} className="grid grid-cols-[3rem_1fr] scroll-mt-6">
              <span className="select-none pr-3 text-right text-muted-foreground/60">{i + 1}</span>
              <span className="min-w-0 pr-4 break-words whitespace-pre-wrap">{line || ' '}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

export function ResolvedAnchor({
  link,
  children,
  className,
}: {
  link: ResolvedLink;
  children: ReactNode;
  className?: string;
}) {
  const style = cn(
    'underline decoration-muted-foreground/50 underline-offset-4 hover:decoration-foreground',
    className,
  );
  if (link.kind === 'internal')
    return (
      <Link href={link.href} className={style}>
        {children}
      </Link>
    );
  if (link.kind === 'external')
    return (
      <a href={link.href} target="_blank" rel="noreferrer" className={style}>
        {children}
        <ExternalLink className="ml-0.5 inline size-3 align-baseline" aria-hidden />
      </a>
    );
  return <span className={className}>{children}</span>;
}

function Inline({ nodes, resolve }: { nodes: MarkdownInline[]; resolve: Resolve }) {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        // biome-ignore lint/suspicious/noArrayIndexKey: inline runs are positional.
        return <span key={i}>{node.text}</span>;
      case 'strong':
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: inline runs are positional.
          <strong key={i} className="font-semibold">
            <Inline nodes={node.children} resolve={resolve} />
          </strong>
        );
      case 'em':
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: inline runs are positional.
          <em key={i}>
            <Inline nodes={node.children} resolve={resolve} />
          </em>
        );
      case 'del':
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: inline runs are positional.
          <del key={i}>
            <Inline nodes={node.children} resolve={resolve} />
          </del>
        );
      case 'code':
        return (
          <code
            // biome-ignore lint/suspicious/noArrayIndexKey: inline runs are positional.
            key={i}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] break-words"
          >
            {node.text}
          </code>
        );
      case 'link':
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: inline runs are positional.
          <ResolvedAnchor key={i} link={resolve(node.href)}>
            <Inline nodes={node.children} resolve={resolve} />
          </ResolvedAnchor>
        );
      case 'break':
        // biome-ignore lint/suspicious/noArrayIndexKey: inline runs are positional.
        return <br key={i} />;
      default:
        return null;
    }
  });
}
