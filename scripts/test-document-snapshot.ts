/** Run repository snapshot regressions independently of other document tooling. */
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const files = [
  ['packages/spec-engine/compat/python/document_snapshot.py', 'scripts/document_snapshot.py'],
  [
    'packages/spec-engine/compat/tests/test_document_snapshot.py',
    'tests/test_document_snapshot.py',
  ],
] as const;
const python = process.env.SPECTRUM_PYTHON ?? 'python3.11';
const root = await mkdtemp(join(tmpdir(), 'spectrum-snapshot-'));
try {
  for (const [source, target] of files) {
    await mkdir(dirname(resolve(root, target)), { recursive: true });
    await writeFile(resolve(root, target), await readFile(resolve(repository, source)));
  }
  const result = spawnSync(
    python,
    ['-B', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_document_snapshot.py'],
    {
      cwd: root,
      stdio: 'inherit',
      timeout: 60000,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(root, { recursive: true, force: true });
}
