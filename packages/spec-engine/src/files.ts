import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export class RepositoryFileError extends Error {
  code: 'unsafe-path' | 'missing-file';
  constructor(code: 'unsafe-path' | 'missing-file', path: string) {
    super(
      code === 'unsafe-path'
        ? `Path must stay inside the repository: ${path}`
        : `Cannot read repository path: ${path}`,
    );
    this.code = code;
  }
}

function escapes(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
}

export async function repositoryPath(root: string, path: string): Promise<string> {
  if (
    !path ||
    isAbsolute(path) ||
    path.includes('\\') ||
    path.includes('\0') ||
    escapes(root, resolve(root, path))
  ) {
    throw new RepositoryFileError('unsafe-path', path);
  }
  let actual: string;
  try {
    actual = await realpath(resolve(root, path));
  } catch {
    throw new RepositoryFileError('missing-file', path);
  }
  if (escapes(root, actual)) throw new RepositoryFileError('unsafe-path', path);
  return actual;
}

export async function readRepositoryText(root: string, path: string): Promise<string> {
  const actual = await repositoryPath(root, path);
  try {
    return await readFile(actual, 'utf8');
  } catch {
    throw new RepositoryFileError('missing-file', path);
  }
}

/** Resolve each entry before traversal; external symlinks are never read. */
export async function repositoryDocuments(
  root: string,
  directory: string,
  onError?: (error: unknown, path: string) => void,
): Promise<string[]> {
  const files: string[] = [];
  const visited = new Set<string>();
  async function walk(path: string) {
    const actual = await repositoryPath(root, path);
    if (visited.has(actual)) return;
    visited.add(actual);
    if ((await stat(actual)).isFile()) {
      if (/\.(md|toml)$/.test(path)) files.push(path);
      return;
    }
    for (const entry of (await readdir(actual)).sort()) {
      const child = `${path}/${entry}`;
      try {
        await walk(child);
      } catch (error) {
        if (onError) onError(error, child);
        else throw error;
      }
    }
  }
  try {
    await walk(directory);
  } catch (error) {
    if (onError) onError(error, directory);
    else throw error;
  }
  return files;
}
