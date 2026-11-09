import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Reads shipped template files from disk. Standalone CLI bundles replace this module with an
// embedded copy of the same files so `init` works without the workspace on disk.

// Resolved on first read: some server bundlers leave `import.meta.dirname` undefined.
function directory(): string {
  return resolve(import.meta.dirname ?? dirname(fileURLToPath(import.meta.url)), '../templates');
}

export async function readTemplateFile(path: string): Promise<string> {
  return readFile(resolve(directory(), path), 'utf8');
}
