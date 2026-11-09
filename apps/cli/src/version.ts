import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Standalone bundles replace this module with the version recorded at build time.
export const VERSION: string = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'),
).version;
