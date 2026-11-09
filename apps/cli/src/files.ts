import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** A repository-relative file the CLI intends to write. */
export interface PlannedFile {
  path: string;
  content: string;
}

export type ExistingFile =
  | { kind: 'missing' }
  | { kind: 'file'; content: string }
  | { kind: 'other' };

function insideRoot(root: string, path: string): string {
  if (isAbsolute(path) || path.split('/').some((part) => part === '..' || part === ''))
    throw new Error(`Refusing to write outside the repository: ${path}`);
  return join(root, path);
}

/** What exists at a repository path. Symlinks and directories are `other` and never followed. */
export async function inspectFile(root: string, path: string): Promise<ExistingFile> {
  const target = insideRoot(root, path);
  try {
    const stat = await lstat(target);
    if (!stat.isFile()) return { kind: 'other' };
    return { kind: 'file', content: await readFile(target, 'utf8') };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'missing' };
    throw error;
  }
}

/** Ensure every existing ancestor of the path resolves inside the repository root. */
async function assertContained(root: string, target: string): Promise<void> {
  const base = await realpath(root);
  let ancestor = dirname(target);
  for (;;) {
    try {
      const real = await realpath(ancestor);
      const rel = relative(base, real);
      if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))) return;
      throw new Error(`Refusing to write through a link outside the repository: ${target}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const parent = dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
}

/**
 * Write a planned file. `create` fails if anything already exists at the path; `replace`
 * overwrites only a regular file. Neither follows a link out of the repository.
 */
export async function writePlannedFile(
  root: string,
  file: PlannedFile,
  mode: 'create' | 'replace',
): Promise<void> {
  const target = insideRoot(resolve(root), file.path);
  await assertContained(root, target);
  await mkdir(dirname(target), { recursive: true });
  await assertContained(root, target);
  if (mode === 'replace' && (await inspectFile(root, file.path)).kind === 'other')
    throw new Error(`Refusing to replace a link or directory: ${file.path}`);
  await writeFile(target, file.content, { flag: mode === 'create' ? 'wx' : 'w' });
}
