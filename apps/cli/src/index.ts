import { run } from './main.ts';

try {
  process.exitCode = await run(process.argv.slice(2));
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
