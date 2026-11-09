import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleCli } from './bundle.ts';

// Writes the npm package's executable. Runs before `pack`; the output is not checked in.

export const OUTPUT = resolve(import.meta.dirname, '../dist/spectrum.mjs');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, await bundleCli('apps/cli/src/build.ts'));
  await chmod(OUTPUT, 0o755);
  console.log('wrote apps/cli/dist/spectrum.mjs');
}
