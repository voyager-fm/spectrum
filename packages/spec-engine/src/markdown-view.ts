import { marked, type Token, type Tokens } from 'marked';

/**
 * A render-ready Markdown tree for read-only viewers. It carries text, never HTML: raw HTML in a
 * document is kept as literal text, so a viewer can render untrusted repository content without
 * injecting markup. Links keep their written `href`; resolving them is the viewer's job.
 */
export type MarkdownInline =
  | { type: 'text'; text: string }
  | { type: 'strong' | 'em' | 'del'; children: MarkdownInline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: MarkdownInline[] }
  | { type: 'break' };

export interface MarkdownListItem {
  task: boolean;
  checked: boolean;
  children: MarkdownBlock[];
}

export type MarkdownAlign = 'left' | 'center' | 'right' | null;

export type MarkdownBlock =
  | { type: 'heading'; depth: number; text: string; slug: string; children: MarkdownInline[] }
  | { type: 'paragraph'; children: MarkdownInline[] }
  | { type: 'list'; ordered: boolean; start: number | null; items: MarkdownListItem[] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'blockquote'; children: MarkdownBlock[] }
  | {
      type: 'table';
      align: MarkdownAlign[];
      header: MarkdownInline[][];
      rows: MarkdownInline[][][];
    }
  | { type: 'rule' };

export interface MarkdownView {
  /** Frontmatter as written, in order. Values are shown as text; they are not re-validated. */
  frontmatter: [string, string][];
  blocks: MarkdownBlock[];
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function decode(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity);
}

/** GitHub-style heading anchor: lowercase, punctuation removed, spaces to hyphens. */
export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function plain(nodes: MarkdownInline[]): string {
  return nodes
    .map((node) =>
      node.type === 'text' || node.type === 'code'
        ? node.text
        : node.type === 'break'
          ? ' '
          : plain(node.children),
    )
    .join('');
}

function inline(tokens: Token[] | undefined): MarkdownInline[] {
  const out: MarkdownInline[] = [];
  for (const token of tokens ?? []) {
    switch (token.type) {
      case 'text':
        if ('tokens' in token && token.tokens?.length) out.push(...inline(token.tokens));
        else out.push({ type: 'text', text: decode(token.text) });
        break;
      case 'escape':
        out.push({ type: 'text', text: decode(token.text) });
        break;
      case 'strong':
      case 'em':
      case 'del':
        out.push({ type: token.type, children: inline(token.tokens) });
        break;
      case 'codespan':
        out.push({ type: 'code', text: decode(token.text) });
        break;
      case 'link':
        out.push({ type: 'link', href: token.href, children: inline(token.tokens) });
        break;
      case 'image':
        // Viewers never fetch repository images; the alt text links to the target instead.
        out.push({
          type: 'link',
          href: token.href,
          children: [{ type: 'text', text: token.text || token.href }],
        });
        break;
      case 'br':
        out.push({ type: 'break' });
        break;
      case 'checkbox':
        break;
      default:
        if ('raw' in token && typeof token.raw === 'string')
          out.push({ type: 'text', text: token.raw });
    }
  }
  return out;
}

function blocks(tokens: Token[], slugs: Map<string, number>): MarkdownBlock[] {
  const out: MarkdownBlock[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'space':
      case 'def':
      case 'checkbox':
        break;
      case 'heading': {
        const children = inline(token.tokens);
        const text = plain(children);
        const base = headingSlug(text) || 'section';
        const seen = slugs.get(base) ?? 0;
        slugs.set(base, seen + 1);
        out.push({
          type: 'heading',
          depth: token.depth,
          text,
          slug: seen ? `${base}-${seen}` : base,
          children,
        });
        break;
      }
      case 'paragraph':
      case 'text':
        out.push({
          type: 'paragraph',
          children: 'tokens' in token && token.tokens ? inline(token.tokens) : [],
        });
        break;
      case 'list': {
        const list = token as Tokens.List;
        out.push({
          type: 'list',
          ordered: list.ordered,
          start: list.ordered && typeof list.start === 'number' ? list.start : null,
          items: list.items.map((item) => ({
            task: item.task,
            checked: item.checked === true,
            children: blocks(item.tokens, slugs),
          })),
        });
        break;
      }
      case 'code':
        out.push({ type: 'code', lang: token.lang ?? '', text: token.text });
        break;
      case 'blockquote':
        out.push({ type: 'blockquote', children: blocks(token.tokens ?? [], slugs) });
        break;
      case 'table': {
        const table = token as Tokens.Table;
        out.push({
          type: 'table',
          align: table.align,
          header: table.header.map((cell) => inline(cell.tokens)),
          rows: table.rows.map((row) => row.map((cell) => inline(cell.tokens))),
        });
        break;
      }
      case 'hr':
        out.push({ type: 'rule' });
        break;
      default:
        // Raw HTML and unknown blocks stay visible as literal text.
        if ('raw' in token && typeof token.raw === 'string' && token.raw.trim())
          out.push({ type: 'paragraph', children: [{ type: 'text', text: token.raw.trim() }] });
    }
  }
  return out;
}

function frontmatterPairs(source: string): [string, string][] {
  const pairs: [string, string][] = [];
  for (const line of source.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    pairs.push([match[1], match[2].replace(/^(["'])(.*)\1$/, '$2')]);
  }
  return pairs;
}

/** Turn a Markdown document into a render-ready tree. Never throws on malformed content. */
export function markdownView(body: string): MarkdownView {
  const match = FRONTMATTER.exec(body);
  const content = match ? body.slice(match[0].length) : body;
  return {
    frontmatter: match ? frontmatterPairs(match[1]) : [],
    blocks: blocks(marked.lexer(content), new Map()),
  };
}
