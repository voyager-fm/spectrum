import { readFile } from 'node:fs/promises';
import { checkRepository } from '@spectrum/spec-engine';

const command = process.argv[2] ?? 'help';
if (!['check', 'list'].includes(command)) {
  console.log('Usage: spectrum check | list [repository path] [--profile profile.json]');
  if (command !== 'help') process.exitCode = 2;
} else {
  try {
    const args = process.argv.slice(3);
    const profileIndex = args.indexOf('--profile');
    if (profileIndex >= 0 && !args[profileIndex + 1])
      throw new Error('--profile requires a JSON source mapping.');
    const profile =
      profileIndex >= 0 ? JSON.parse(await readFile(args[profileIndex + 1], 'utf8')) : undefined;
    if (profileIndex >= 0) args.splice(profileIndex, 2);
    if (args.length > 1 || args.some((arg) => arg.startsWith('-')))
      throw new Error('Expected one repository path and an optional --profile mapping.');
    const result = await checkRepository(args[0] ?? process.cwd(), { config: profile });
    console.log(JSON.stringify(command === 'list' ? result.specs : result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (e) {
    console.error(String(e));
    process.exitCode = 1;
  }
}
