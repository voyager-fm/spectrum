import {
  type BundledLanguage,
  createHighlighter,
  type Highlighter,
  type ThemeRegistration,
} from 'shiki';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

/** One run of text in a highlighted line; unset fields mean plain ink. */
export type HighlightToken = { text: string; color?: string; bold?: boolean; italic?: boolean };

const rule = (scope: string[], foreground: string, fontStyle?: string) => ({
  scope,
  settings: { foreground, ...(fontStyle ? { fontStyle } : {}) },
});

/**
 * Token colors are `--code-*` CSS variables that globals.css derives from the ink tokens and the
 * one brand accent, so highlighting stays on the neutral palette and follows the color scheme
 * without a second theme. Later rules win over earlier ones of equal depth.
 */
const theme: ThemeRegistration = {
  name: 'spectrum',
  type: 'light',
  colors: { 'editor.foreground': 'var(--foreground)', 'editor.background': 'transparent' },
  tokenColors: [
    rule(['punctuation', 'meta.brace', 'keyword.operator'], 'var(--code-punctuation)'),
    rule(
      ['keyword', 'storage', 'keyword.operator.new', 'keyword.operator.expression'],
      'var(--code-keyword)',
    ),
    rule(['string', 'punctuation.definition.string', 'markup.inline.raw'], 'var(--code-string)'),
    rule(['constant', 'support.constant', 'variable.other.enummember'], 'var(--code-constant)'),
    rule(
      [
        'support.type.property-name',
        'support.type.property-name punctuation',
        'entity.name.tag',
        'meta.object-literal.key',
      ],
      'var(--code-key)',
    ),
    rule(
      [
        'entity.name.section',
        'entity.name.section punctuation',
        'meta.group.toml punctuation',
        'markup.heading',
        'markup.bold',
      ],
      'var(--code-key)',
      'bold',
    ),
    rule(['entity.name.function', 'support.function'], 'var(--code-key)'),
    rule(['markup.inserted'], 'var(--code-keyword)'),
    rule(['markup.deleted', 'markup.italic'], 'var(--code-comment)', 'italic'),
    rule(['comment', 'punctuation.definition.comment'], 'var(--code-comment)', 'italic'),
  ],
};

/** Languages repository documents and their fenced blocks use; anything else renders plain. */
const LANGUAGES = [
  'toml',
  'json',
  'jsonc',
  'yaml',
  'markdown',
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'shellscript',
  'diff',
  'sql',
  'html',
  'css',
] as const satisfies BundledLanguage[];

const ALIASES: Record<string, (typeof LANGUAGES)[number]> = {
  yml: 'yaml',
  md: 'markdown',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  shell: 'shellscript',
  console: 'shellscript',
  patch: 'diff',
};

/**
 * Tables are tokenized here rather than by Shiki, whose grammars color every column a different
 * hue: the header row is bold and alternate columns take the string tone so columns stay legible.
 */
const DELIMITERS = { tsv: '\t', csv: ',' } as const;

/** Resolves a fence language or file extension to a loaded grammar, or `null` for plain text. */
export function highlightLanguage(label: string | undefined) {
  const key = label?.trim().toLowerCase();
  if (!key) return null;
  if (Object.hasOwn(DELIMITERS, key)) return key as keyof typeof DELIMITERS;
  if ((LANGUAGES as readonly string[]).includes(key)) return key as (typeof LANGUAGES)[number];
  return Object.hasOwn(ALIASES, key) ? ALIASES[key] : null;
}

function delimitedLines(source: string, delimiter: string): HighlightToken[][] {
  return source.split('\n').map((line, row) =>
    line.split(delimiter).flatMap((cell, column) => {
      const tokens: HighlightToken[] = [];
      if (column) tokens.push({ text: delimiter, color: 'var(--code-punctuation)' });
      if (cell)
        tokens.push(
          row === 0
            ? { text: cell, color: 'var(--code-key)', bold: true }
            : column % 2
              ? { text: cell, color: 'var(--code-string)' }
              : { text: cell },
        );
      return tokens;
    }),
  );
}

let highlighter: Promise<Highlighter> | undefined;

function load() {
  highlighter ??= createHighlighter({
    themes: [theme],
    langs: [...LANGUAGES],
    engine: createJavaScriptRegexEngine(),
  }).catch((error: unknown) => {
    highlighter = undefined;
    throw error;
  });
  return highlighter;
}

/**
 * Above this many characters a document renders plain: pages are rendered per request, and
 * tokenizing a very large file would delay the page for presentation alone.
 */
export const MAX_HIGHLIGHT_LENGTH = 200_000;

/**
 * Splits `text` into lines of colored tokens. Unknown languages, oversized sources and any
 * grammar failure return unhighlighted lines: highlighting is presentation and never hides the
 * source.
 */
export async function highlightLines(
  text: string,
  label: string | undefined,
): Promise<HighlightToken[][]> {
  const source = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  const plain = () => source.split('\n').map((line) => (line ? [{ text: line }] : []));
  const lang = highlightLanguage(label);
  if (!lang || source.length > MAX_HIGHLIGHT_LENGTH) return plain();
  if (lang === 'tsv' || lang === 'csv') return delimitedLines(source, DELIMITERS[lang]);
  try {
    const { tokens } = (await load()).codeToTokens(source, { lang, theme: 'spectrum' });
    return tokens.map((line) =>
      line.map(({ content, color, fontStyle = 0 }) => ({
        text: content,
        ...(color?.startsWith('var(--code-') ? { color } : {}),
        ...(fontStyle & 2 ? { bold: true } : {}),
        ...(fontStyle & 1 ? { italic: true } : {}),
      })),
    );
  } catch {
    return plain();
  }
}
