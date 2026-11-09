import { readFile } from 'node:fs/promises';
import { checkRepository } from '@spectrum/spec-engine';
import { initRepository, installSkills, parseAgents } from './setup-commands.ts';
import { VERSION } from './version.ts';

const USAGE = `Usage: spectrum <command> [repository path] [options]

Commands:
  check [path] [--profile profile.json]   Validate .spectrum specs; prints JSON
  list [path] [--profile profile.json]    List parsed interaction specs; prints JSON
  init [path] [--name project] [--dry-run]
                                          Write .spectrum/config.json and a starter bundle
  skills install [path] [--agent claude|codex|all] [--force] [--dry-run]
                                          Install the Spectrum agent skill into the repository
  --version                               Print the installed version`;

/** Options each command accepts; `true` takes a value, `false` is a boolean flag. */
const COMMANDS: Record<string, Record<string, boolean>> = {
  check: { '--profile': true },
  list: { '--profile': true },
  init: { '--name': true, '--dry-run': false },
  'skills install': { '--agent': true, '--force': false, '--dry-run': false },
};

class UsageError extends Error {}

function parse(argv: string[]): {
  command: string;
  path: string | undefined;
  options: Map<string, string | true>;
} {
  const command = argv[0] === 'skills' ? `skills ${argv[1] ?? ''}`.trim() : (argv[0] ?? '');
  const accepted = COMMANDS[command];
  if (!accepted) throw new UsageError();
  const rest = argv.slice(command.split(' ').length);
  const options = new Map<string, string | true>();
  const positional: string[] = [];
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (!arg.startsWith('-')) {
      positional.push(arg);
      continue;
    }
    if (!Object.hasOwn(accepted, arg)) throw new Error(`Unexpected option for ${command}: ${arg}`);
    if (options.has(arg)) throw new Error(`${arg} was given more than once.`);
    if (!accepted[arg]) {
      options.set(arg, true);
      continue;
    }
    const value = rest[++index];
    if (value === undefined || value.startsWith('-')) throw new Error(`${arg} requires a value.`);
    options.set(arg, value);
  }
  if (positional.length > 1) throw new Error('Expected at most one repository path.');
  return { command, path: positional[0], options };
}

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

async function run(argv: string[]): Promise<number> {
  if (argv[0] === '--version' || argv[0] === 'version') {
    console.log(VERSION);
    return 0;
  }
  if (!argv.length || argv[0] === 'help' || argv[0] === '--help') {
    console.log(USAGE);
    return 0;
  }
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.log(USAGE);
    return 2;
  }
  const { command, options } = parsed;
  const root = parsed.path ?? process.cwd();
  const value = (name: string) => options.get(name) as string | undefined;
  if (command === 'check' || command === 'list') {
    const profilePath = value('--profile');
    const profile = profilePath ? JSON.parse(await readFile(profilePath, 'utf8')) : undefined;
    const result = await checkRepository(root, { config: profile });
    print(command === 'list' ? result.specs : result);
    return result.ok ? 0 : 1;
  }
  if (command === 'init') {
    const result = await initRepository(root, {
      name: value('--name'),
      dryRun: options.has('--dry-run'),
    });
    print(result);
    return result.ok && (result.check?.ok ?? true) ? 0 : 1;
  }
  const result = await installSkills(root, VERSION, {
    agents: parseAgents(value('--agent')),
    force: options.has('--force'),
    dryRun: options.has('--dry-run'),
  });
  print(result);
  return result.ok ? 0 : 1;
}

try {
  process.exitCode = await run(process.argv.slice(2));
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
