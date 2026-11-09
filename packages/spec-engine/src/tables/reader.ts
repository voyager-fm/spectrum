/**
 * String-preserving physical-line TSV parsing and bounded customer-root reads.
 */

import { createHash } from 'node:crypto';
import { lstat, readFile, readlink, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function parseTsvLine(line: string, source: string, number: number): string[] {
  const cells: string[] = [];
  for (const cell of line.split('\t')) {
    if (!cell.startsWith('"')) {
      cells.push(cell);
      continue;
    }
    if (!cell.endsWith('"') || cell.length < 2) {
      throw new Error(
        `${source}:${number}: malformed quoted TSV cell (multiline/tab cells are unsupported)`,
      );
    }
    const inner = cell.slice(1, -1);
    if (inner.replace(/""/g, '').includes('"'))
      throw new Error(`${source}:${number}: malformed quoted TSV cell`);
    cells.push(inner.replace(/""/g, '"'));
  }
  return cells;
}
export function headerColumns(line: string, source: string): string[] {
  const columns = parseTsvLine(line.replace(/^\uFEFF/, '').replace(/\r$/, ''), source, 1);
  if (!columns.length || columns.some((col) => !identifier.test(col)))
    throw new Error(`${source}: invalid/empty TSV header`);
  if (new Set(columns).size !== columns.length)
    throw new Error(`${source}: duplicate TSV header column`);
  return columns;
}
export function parseTable(text: string, source: string) {
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  const columns = headerColumns(lines.shift() ?? '', source);
  const rows = lines.map((line, i) => {
    if (!line.trim()) throw new Error(`${source}:${i + 2}: empty TSV row`);
    const values = parseTsvLine(line, source, i + 2);
    if (values.length !== columns.length)
      throw new Error(
        `${source}:${i + 2}: expected ${columns.length} columns, got ${values.length}`,
      );
    return Object.freeze(Object.fromEntries(columns.map((key, j) => [key, values[j]])));
  });
  return { columns, rows };
}
function inside(root: string, absolute: string, path: string) {
  const rel = relative(root, absolute);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
    throw new Error(`Source escapes customer root: ${path}`);
}
export async function sourcePath(root: string, path: string) {
  if (!path || isAbsolute(path)) throw new Error(`Invalid relative source path: ${path}`);
  root = await realpath(root);
  const absolute = resolve(root, path);
  inside(root, absolute, path);
  // Walk symlinks explicitly: even a dangling link must not hide an escape as ENOENT.
  async function walk(target: string, depth: number): Promise<string> {
    if (depth > 40) throw new Error(`Too many source symlinks: ${path}`);
    inside(root, target, path);
    const parts = relative(root, target).split(sep).filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      current = resolve(current, parts[i]);
      if ((await lstat(current)).isSymbolicLink()) {
        const destination = resolve(current, '..', await readlink(current));
        inside(root, destination, path);
        return walk(resolve(destination, ...parts.slice(i + 1)), depth + 1);
      }
    }
    return current;
  }
  return walk(absolute, 0);
}
export const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

/** Per-call optimistic read transaction. Rechecks all observed bytes before return. */
export function createReadSession(root: string) {
  const canonicalRoot = realpath(root);
  const observed = new Map<string, { absolute: string; hash: string }>();
  const absent = new Set<string>();
  async function read(path: string): Promise<string> {
    const absolute = await sourcePath(await canonicalRoot, path);
    if (!(await stat(absolute)).isFile()) throw new Error(`Not a file: ${path}`);
    const bytes = await readFile(absolute);
    const hash = digest(bytes);
    const prior = observed.get(path);
    if (absent.has(path) || (prior && (prior.hash !== hash || prior.absolute !== absolute)))
      throw new Error(`Source changed during query: ${path}`);
    observed.set(path, { absolute, hash });
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  }
  async function optional(path: string): Promise<string | null> {
    try {
      return await read(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      if (observed.has(path))
        throw new Error(`Source changed during query: ${path}`, { cause: error });
      absent.add(path);
      return null;
    }
  }
  async function finish(expected?: string) {
    for (const [path, entry] of observed) {
      try {
        const actual = await sourcePath(await canonicalRoot, path);
        if (actual !== entry.absolute || digest(await readFile(actual)) !== entry.hash)
          throw new Error(`Source changed during query: ${path}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
          throw new Error(`Source changed during query: ${path}`, { cause: error });
        throw error;
      }
    }
    for (const path of absent) {
      try {
        await sourcePath(await canonicalRoot, path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
      throw new Error(`Source changed during query: ${path}`);
    }
    const entries = [...observed].sort(([a], [b]) => compareText(a, b));
    const contentDigest = digest(
      JSON.stringify({
        files: entries.map(([path, value]) => [path, value.hash]),
        absent: [...absent].sort(compareText),
      }),
    );
    if (expected && expected !== contentDigest)
      throw new Error('Stale snapshot: selected source content changed');
    return {
      kind: 'worktree' as const,
      scope: 'selected-sources' as const,
      contentDigest,
      paths: [...observed.keys(), ...absent].sort(compareText),
    };
  }
  return { read, optional, finish };
}
