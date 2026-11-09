import { chmod, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleCli as bundleStandaloneCli } from '../../cli/src/bundle.ts';
import { validatePlugin } from './validate.ts';

// Validates the plugin and bundles apps/cli, behind the launcher, into every skill that runs it.
// `--check` writes nothing and fails when a checked-in bundle is stale.

const pluginRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(pluginRoot, '../..');
const BUNDLE = 'scripts/spectrum.mjs';

const LAUNCHER = resolve(import.meta.dirname, 'launcher.ts');

/** The plugin's `scripts/spectrum.mjs`: the CLI behind the launcher that picks which CLI runs. */
export function bundleCli(): Promise<string> {
  return bundleStandaloneCli('apps/plugin/src/build.ts', LAUNCHER);
}

async function readOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function main(check: boolean): Promise<number> {
  const problems = await validatePlugin(pluginRoot);
  const bundle = await bundleCli();
  const skillsDir = join(pluginRoot, 'skills');
  for (const entry of await readdir(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skill = join(skillsDir, entry.name);
    const body = await readOrNull(join(skill, 'SKILL.md'));
    if (!body?.includes(BUNDLE)) continue;
    const target = join(skill, BUNDLE);
    if (check) {
      if ((await readOrNull(target)) !== bundle) {
        problems.push({
          path: target,
          message: 'CLI bundle is missing or stale; run pnpm plugin:build',
        });
      }
    } else {
      await writeFile(target, bundle);
      await chmod(target, 0o755);
      console.log(`wrote ${relative(repoRoot, target)}`);
    }
  }
  for (const p of problems) console.error(`${relative(repoRoot, p.path)}: ${p.message}`);
  console.log(problems.length ? `plugin: ${problems.length} problem(s)` : 'plugin: ok');
  return problems.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = await main(process.argv.includes('--check'));
