import { readFile } from 'node:fs/promises';
import { checkRepository } from '@spectrum/spec-engine';
import { SETUP } from '@spectrum/spec-engine/setup';
import {
  type DiagnosticsOptions,
  diagnosticsExitCode,
  renderDiagnostics,
  repositoryDiagnostics,
} from './diagnostics.ts';
import { createDraft, describeDraft, readTemplateValues } from './new-command.ts';
import { formatCheckResult, formatSpecList, parseOutputFormat } from './output.ts';
import { initRepository, installSkills, parseAgents, repositoryStatus } from './setup-commands.ts';
import { VERSION } from './version.ts';

const USAGE = `Usage: spectrum <command> [repository path] [options]

Commands:
  check [path] [--profile profile.json] [--format json|text|github]
                                          Validate .spectrum specs; JSON by default
  list [path] [--profile profile.json] [--format json|text]
                                          List parsed interaction specs; JSON by default
  init [path] [--name project] [--dry-run]
                                          Write .spectrum/config.json and a starter bundle
  skills install [path] [--agent claude|codex|all] [--force] [--dry-run]
                                          Install the Spectrum agent skill into the repository
  status [path]                           Report configuration, package and agent skill setup
  doctor [path] [--format json|text]       Inspect local evidence and run structural checks; no repairs
  new <kind> [path] --values values.json [--out relative-path] [--dry-run]
                                          Create drafts from canonical templates; never overwrite
  new <kind> --describe                    List required template inputs without writing
  --version                               Print the package name and installed version`;

/** Options each command accepts; `true` takes a value, `false` is a boolean flag. */
const COMMANDS: Record<string, Record<string, boolean>> = {
  check: { '--profile': true, '--format': true },
  list: { '--profile': true, '--format': true },
  init: { '--name': true, '--dry-run': false },
  'skills install': { '--agent': true, '--force': false, '--dry-run': false },
  status: {},
  doctor: { '--format': true },
  new: {
    '--values': true,
    '--out': true,
    '--dry-run': false,
    '--describe': false,
    '--help': false,
  },
};

class UsageError extends Error {}

function parse(argv: string[]): {
  command: string;
  path: string | undefined;
  kind?: string;
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
  if (command === 'new') {
    if (!positional.length || positional.length > 2)
      throw new Error('Expected a template kind and at most one repository path.');
    return { command, kind: positional[0], path: positional[1], options };
  }
  if (positional.length > 1) throw new Error('Expected at most one repository path.');
  return { command, path: positional[0], options };
}

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

/** Run one CLI invocation and return its exit status. */
export async function run(
  argv: string[],
  runtime: Pick<DiagnosticsOptions, 'cliSource'> = {},
): Promise<number> {
  if (argv[0] === '--version' || argv[0] === 'version') {
    console.log(`${SETUP.packageName} ${VERSION}`);
    return 0;
  }
  if (!argv.length || argv[0] === 'help' || argv[0] === '--help') {
    console.log(USAGE);
    return 0;
  }
  if (argv[0] === 'new' && argv.length === 2 && argv[1] === '--help') {
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
  if (command === 'doctor') {
    const format = parseOutputFormat(value('--format'));
    const result = await repositoryDiagnostics(root, {
      mode: 'doctor',
      cliVersion: VERSION,
      cliPath: process.argv[1],
      cliSource: runtime.cliSource ?? 'unknown',
    });
    if (format === 'text') console.log(renderDiagnostics(result));
    else print(result);
    return diagnosticsExitCode(result);
  }
  if (command === 'new') {
    if (options.has('--help')) {
      console.log(USAGE);
      return 0;
    }
    if (!parsed.kind) throw new Error('Expected a template kind.');
    if (options.has('--describe')) {
      if (options.size !== 1) throw new Error('--describe cannot be combined with write options.');
      print(await describeDraft(parsed.kind));
      return 0;
    }
    const valuesPath = value('--values');
    if (!valuesPath) throw new Error('new requires --values with a JSON string-map file.');
    const result = await createDraft(root, parsed.kind, {
      values: await readTemplateValues(valuesPath),
      out: value('--out'),
      dryRun: options.has('--dry-run'),
    });
    print(result);
    return result.ok ? 0 : 1;
  }
  if (command === 'check' || command === 'list') {
    const checkFormat =
      command === 'check' ? parseOutputFormat(value('--format'), true) : undefined;
    const listFormat = command === 'list' ? parseOutputFormat(value('--format')) : undefined;
    const profilePath = value('--profile');
    const profile = profilePath ? JSON.parse(await readFile(profilePath, 'utf8')) : undefined;
    const result = await checkRepository(root, { config: profile });
    console.log(
      command === 'list'
        ? formatSpecList(result, listFormat)
        : formatCheckResult(result, checkFormat),
    );
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
  if (command === 'status') {
    const result = await repositoryStatus(root, VERSION);
    print(result);
    return result.ready ? 0 : 1;
  }
  const result = await installSkills(root, VERSION, {
    agents: parseAgents(value('--agent')),
    force: options.has('--force'),
    dryRun: options.has('--dry-run'),
  });
  print(result);
  return result.ok ? 0 : 1;
}
