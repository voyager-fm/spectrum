import { checkRepository } from '@spectrum/spec-engine';
const command = process.argv[2] ?? 'help';
if (!['check', 'list'].includes(command)) {
  console.log('Usage: spectrum check | list [repository path]');
  if (command !== 'help') process.exitCode = 2;
} else {
  try {
    const result = await checkRepository(process.argv[3] ?? process.cwd());
    console.log(
      JSON.stringify(command === 'list' ? result.specs : result, null, 2),
    );
    if (!result.ok) process.exitCode = 1;
  } catch (e) {
    console.error(String(e));
    process.exitCode = 1;
  }
}
