import { spawnSync } from 'node:child_process';
import { run } from '../../cli/src/main.ts';
import { VERSION } from '../../cli/src/version.ts';
import { compareVersions, describe, selectCli } from './resolve.ts';

// Entry of the plugin's bundled `scripts/spectrum.mjs`. It runs the CLI the repository pins, a
// newer global install, or this bundle, and names the one that ran on stderr. Stdout and the
// exit status are the chosen CLI's own, so JSON results stay machine-readable.

const USAGE_STATUS = 2;
const MAX_OUTPUT = 256 * 1024 * 1024;

async function launch(argv: string[]): Promise<number> {
  const { cli, notes } = selectCli({
    cwd: process.cwd(),
    env: process.env,
    bundledVersion: VERSION,
    platform: process.platform,
  });
  for (const note of notes) console.error(`spectrum: ${note}`);
  if (!cli) {
    console.error(describe(null, VERSION));
    return run(argv);
  }
  // An older pinned CLI may not have a command this skill describes. Capture its output so a
  // usage rejection can fall back to the bundle instead of reaching the agent as a result.
  const older = (compareVersions(cli.version, VERSION) ?? -1) < 0;
  const result = spawnSync(cli.command, [...cli.args, ...argv], {
    cwd: process.cwd(),
    env: process.env,
    stdio: older ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: MAX_OUTPUT,
    shell: process.platform === 'win32' && !cli.command.endsWith('.exe'),
  });
  if (result.error) {
    console.error(`spectrum: could not run the ${cli.source} CLI: ${result.error.message}`);
    // Only a CLI that never started is safe to replace; one that ran may have written files.
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'EACCES') return 1;
    console.error(describe(null, VERSION));
    return run(argv);
  }
  if (older && result.status === USAGE_STATUS) {
    console.error(
      `spectrum: the ${cli.source} CLI ${cli.version ?? '(unknown version)'} does not accept ` +
        `this command; running the bundled ${VERSION} instead.`,
    );
    console.error(describe(null, VERSION));
    return run(argv);
  }
  if (older) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  }
  console.error(describe(cli, VERSION));
  return result.status ?? 1;
}

try {
  process.exitCode = await launch(process.argv.slice(2));
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
