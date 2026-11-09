import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Reads shipped template files from disk. Standalone CLI bundles replace this module with an
// embedded copy of the same files so `init` works without the workspace on disk.

const directory = resolve(import.meta.dirname, '../templates');

export async function readTemplateFile(path: string): Promise<string> {
  return readFile(resolve(directory, path), 'utf8');
}
