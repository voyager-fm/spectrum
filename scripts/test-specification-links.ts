/** Verify link resolution on neutral, isolated specification repositories. */
import { spawnSync } from 'node:child_process';
import { delimiter, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pythonPath = [resolve(root, 'packages/spec-engine/compat/python'), process.env.PYTHONPATH]
  .filter(Boolean)
  .join(delimiter);
const result = spawnSync(
  process.env.SPECTRUM_PYTHON ?? 'python3.11',
  [
    '-B',
    '-m',
    'unittest',
    'discover',
    '-s',
    'packages/spec-engine/compat/tests',
    '-p',
    'test_specification_links.py',
  ],
  {
    cwd: root,
    stdio: 'inherit',
    timeout: 120000,
    env: { ...process.env, PYTHONPATH: pythonPath, PYTHONDONTWRITEBYTECODE: '1' },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
