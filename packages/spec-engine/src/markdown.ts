import type { AcceptanceCriterion } from '@spectrum/core';
import { marked, type Token } from 'marked';
import { parse } from 'yaml';

export const interactionSections = [
  'Intent',
  'Trigger / Entry Points',
  'Preconditions',
  'Expected Outcome',
  'State Changes',
  'User-visible Feedback',
  'Edge Cases / Failure Handling',
  'Acceptance Criteria',
  'Permissions / Dependencies',
  'Observability / Analytics',
  'Related Interactions',
  'Source',
];

export interface DocumentLink {
  target: string;
  rootRelative: boolean;
  section: string;
}
export interface MarkdownDocument {
  metadata: Record<string, unknown>;
  title: string | null;
  sections: string[];
  acceptance: AcceptanceCriterion[];
  invalidAcceptance: string[];
  links: DocumentLink[];
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseMarkdown(body: string): MarkdownDocument {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(body);
  if (/^---\r?\n/.test(body) && !frontmatter) throw new Error('Unclosed YAML frontmatter');
  const metadata: unknown = frontmatter
    ? parse(frontmatter[1], { uniqueKeys: true, maxAliasCount: 25 })
    : {};
  if (!record(metadata)) throw new Error('Frontmatter must be a mapping');
  const tokens = marked.lexer(frontmatter ? body.slice(frontmatter[0].length) : body);
  const sections: string[] = [];
  const acceptance: AcceptanceCriterion[] = [];
  const invalidAcceptance: string[] = [];
  const links: DocumentLink[] = [];
  let section = '';
  let title: string | null = null;
  for (const token of tokens) {
    if (token.type === 'heading' && token.depth === 1 && !title) title = token.text;
    if (token.type === 'heading' && token.depth === 2) {
      section = token.text;
      sections.push(section);
    }
    if (section === 'Acceptance Criteria' && token.type === 'list') {
      for (const item of token.items) {
        const match = /^\*\*AC-([1-9]\d*):\*\*\s+([\s\S]+)/.exec(item.text);
        if (!item.task || !match) invalidAcceptance.push(item.text);
        acceptance.push({
          id: match ? `AC-${match[1]}` : null,
          statement: match ? match[2].trim() : item.text.trim(),
          checked: item.checked === true,
          verification: 'not_recorded',
        });
      }
    }
    // Marked does not recurse into code blocks or inline code for link tokens.
    marked.walkTokens([token], (child: Token) => {
      if (child.type === 'link' || child.type === 'image')
        links.push({ target: child.href, rootRelative: false, section });
      if (child.type === 'text' && !child.tokens) {
        for (const match of child.text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
          links.push({ target: match[1], rootRelative: true, section });
        }
      }
    });
  }
  return { metadata, title, sections, acceptance, invalidAcceptance, links };
}
