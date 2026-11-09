import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { renderStarterBundle, SETUP, SETUP_COMMANDS } from '@spectrum/spec-engine/setup';
import { diagnosticsExitCode, renderDiagnostics, repositoryDiagnostics } from './diagnostics.ts';
import { repositorySkill } from './skill.ts';

async function fixture(t: { after: (cleanup: () => Promise<void>) => void }) {
  const root = await mkdtemp(join(tmpdir(), 'spectrum 진단 space-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function put(root: string, path: string, content: string) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), content);
}

async function configured(root: string) {
  for (const file of await renderStarterBundle('Neutral project'))
    await put(root, file.path, file.content);
}

async function local(root: string, declared = '^1.2.0', installed = '1.2.3') {
  await put(
    root,
    'package.json',
    JSON.stringify({ devDependencies: { [SETUP.packageName]: declared } }),
  );
  await put(
    root,
    `node_modules/${SETUP.packageName}/package.json`,
    JSON.stringify({ name: SETUP.packageName, version: installed }),
  );
  await put(root, SETUP.skills.claude, repositorySkill('1.2.3'));
}

async function bytes(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile())
        result[relative(root, path)] = (await readFile(path)).toString('hex');
    }
  }
  await visit(root);
  return result;
}

test('status reports real setup, supplied active CLI and distinct declaration/install evidence', async (t) => {
  const root = await fixture(t);
  await configured(root);
  await local(root);
  const before = await bytes(root);
  const result = await repositoryDiagnostics(root, {
    cliVersion: '1.2.3',
    cliPath: '/active/cli.mjs',
    cliSource: 'repository',
  });
  assert.equal(result.root, root);
  assert.equal(result.cli.path, '/active/cli.mjs');
  assert.equal(result.package.declaredRange, '^1.2.0');
  assert.equal(result.package.installedVersion, '1.2.3');
  assert.equal(result.ready, true);
  assert.equal(result.check.status, 'notRun');
  assert.equal(diagnosticsExitCode(result), 0);
  assert.equal(
    result.issues.some((entry) => entry.path === SETUP.skills.codex),
    false,
  );
  assert.match(renderDiagnostics(result), /file presence does not prove host loading/);
  assert.deepEqual(await bytes(root), before);
});

test('doctor runs the actual checker on the canonical starter bundle without writes', async (t) => {
  const root = await fixture(t);
  await configured(root);
  await local(root);
  const before = await bytes(root);
  const result = await repositoryDiagnostics(root, { mode: 'doctor', cliVersion: '1.2.3' });
  assert.equal(result.check.status, 'passed');
  assert.equal(result.check.errors, 0);
  assert.ok(result.check.warnings > 0); // Real unresolved starter decisions remain warnings.
  assert.equal(diagnosticsExitCode(result), 0);
  assert.deepEqual(await bytes(root), before);
});

test('missing configuration skips doctor instead of manufacturing a successful check', async (t) => {
  const root = await fixture(t);
  const result = await repositoryDiagnostics(root, { mode: 'doctor' });
  assert.equal(result.check.status, 'notRun');
  assert.match(result.check.reason ?? '', /not run/);
  assert.equal(diagnosticsExitCode(result), 1);
  assert.deepEqual(
    new Set(result.next),
    new Set([SETUP_COMMANDS.init, SETUP_COMMANDS.install, SETUP_COMMANDS.skills]),
  );
  assert.deepEqual(await readdir(root), []);
});

test('invalid JSON configuration does not suggest initialization over existing content', async (t) => {
  const root = await fixture(t);
  await put(root, SETUP.config, '{broken');
  const result = await repositoryDiagnostics(root, { mode: 'doctor', cliSource: 'plugin' });
  assert.equal(result.setup.config.state, 'invalid');
  assert.equal(result.check.status, 'notRun');
  assert.equal(result.next.includes(SETUP_COMMANDS.init), false);
  assert.equal(await readFile(join(root, SETUP.config), 'utf8'), '{broken');
});

test('schema marker alone is not a valid doctor check', async (t) => {
  const root = await fixture(t);
  await put(root, SETUP.config, JSON.stringify({ schema_version: 2 }));
  const result = await repositoryDiagnostics(root, { mode: 'doctor', cliSource: 'plugin' });
  assert.equal(result.check.status, 'failed');
  assert.ok(result.issues.some((entry) => entry.code === 'invalid-config'));
  assert.equal(diagnosticsExitCode(result), 1);
});

test('skill drift compares marker against active CLI rather than a declared range', async (t) => {
  const root = await fixture(t);
  await configured(root);
  await local(root, 'file:../local-package');
  const result = await repositoryDiagnostics(root, { cliVersion: '2.0.0' });
  assert.equal(result.package.declaredRange, 'file:../local-package');
  assert.equal(result.package.installedVersion, '1.2.3');
  assert.ok(
    result.issues.some(
      (entry) => entry.code === 'skill-version-mismatch' && entry.severity === 'warning',
    ),
  );
  assert.ok(result.issues.some((entry) => entry.code === 'installed-cli-version-mismatch'));
  assert.ok(result.next.includes(SETUP_COMMANDS.skills));
  assert.equal(diagnosticsExitCode(result), 0);
});

test('declaration without installed evidence never reports an installed version', async (t) => {
  const root = await fixture(t);
  await configured(root);
  await put(
    root,
    'package.json',
    JSON.stringify({ dependencies: { [SETUP.packageName]: 'file:../package' } }),
  );
  const result = await repositoryDiagnostics(root, { cliSource: 'repository' });
  assert.equal(result.package.installedVersion, null);
  assert.equal(result.ready, false);
  assert.ok(result.next.includes(SETUP_COMMANDS.install));
});

test('caller-selected bundled plugin path does not require a local package or unused host skills', async (t) => {
  const root = await fixture(t);
  await configured(root);
  const result = await repositoryDiagnostics(root, {
    cliSource: 'plugin',
    cliVersion: '1.2.3',
    cliPath: '/installed/plugin/cli.mjs',
  });
  assert.equal(result.ready, true);
  assert.equal(
    result.issues.some((entry) => entry.severity === 'error'),
    false,
  );
  assert.equal(result.next.includes(SETUP_COMMANDS.install), false);
  assert.equal(result.next.includes(SETUP_COMMANDS.skills), false);
  assert.equal(result.next.includes(SETUP_COMMANDS.check), false);
  assert.match(renderDiagnostics(result), /Host loading is not independently verified/);
});

test('plugin enablement declaration alone does not establish active plugin CLI or installed package', async (t) => {
  const root = await fixture(t);
  await configured(root);
  await put(
    root,
    SETUP.claudeSettings,
    JSON.stringify({ enabledPlugins: { [SETUP.plugin]: true } }),
  );
  const result = await repositoryDiagnostics(root);
  assert.equal(result.cli.source, 'unknown');
  assert.equal(result.ready, false);
  assert.match(
    renderDiagnostics(result),
    /installation, loading, and bundled CLI version are not verified/,
  );
});

test('unmanaged skill content is preserved without suggesting automatic force replacement', async (t) => {
  const root = await fixture(t);
  await configured(root);
  await local(root);
  await put(root, SETUP.skills.claude, '# User-owned skill\n');
  const result = await repositoryDiagnostics(root, { cliVersion: '1.2.3' });
  assert.ok(result.issues.some((entry) => entry.code === 'skill-unmanaged'));
  assert.equal(
    result.next.some((command) => command.includes('--force')),
    false,
  );
  assert.equal(await readFile(join(root, SETUP.skills.claude), 'utf8'), '# User-owned skill\n');
});

test('arbitrary repository binaries are never executed for version evidence', async (t) => {
  const root = await fixture(t);
  await configured(root);
  await local(root);
  await put(
    root,
    SETUP.localBin,
    `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(join(root, 'unexpected-execution'))}, 'executed');\n`,
  );
  await chmod(join(root, SETUP.localBin), 0o755);
  const before = await bytes(root);
  const result = await repositoryDiagnostics(root, { cliVersion: '1.2.3' });
  assert.equal(result.ready, true);
  assert.match(renderDiagnostics(result), /local binary was not executed/);
  assert.deepEqual(await bytes(root), before);
});

test('symlinked configuration is unsafe and doctor never follows it', async (t) => {
  const root = await fixture(t);
  const outside = await fixture(t);
  await configured(outside);
  await symlink(join(outside, '.spectrum'), join(root, '.spectrum'), 'dir');
  const before = await bytes(outside);
  const result = await repositoryDiagnostics(root, { mode: 'doctor', cliSource: 'plugin' });
  assert.equal(result.setup.config.state, 'invalid');
  assert.equal(result.check.status, 'notRun');
  assert.equal(result.ready, false);
  assert.deepEqual(await bytes(outside), before);
});

test('external installed-package symlink never yields observed installed version', async (t) => {
  const root = await fixture(t);
  const outside = await fixture(t);
  await configured(root);
  await put(outside, 'package.json', JSON.stringify({ name: SETUP.packageName, version: '9.9.9' }));
  const packageDirectory = join(root, 'node_modules', dirname(SETUP.packageName));
  await mkdir(packageDirectory, { recursive: true });
  await symlink(outside, join(root, 'node_modules', SETUP.packageName), 'dir');
  const result = await repositoryDiagnostics(root, { cliSource: 'plugin' });
  assert.equal(result.package.state, 'invalid');
  assert.equal(result.package.installedVersion, null);
});

test('direct config symlink and oversized fixed files are invalid rather than missing', async (t) => {
  const root = await fixture(t);
  const outside = await fixture(t);
  await put(outside, 'config.json', JSON.stringify({ schema_version: 2 }));
  await mkdir(join(root, dirname(SETUP.config)), { recursive: true });
  await symlink(join(outside, 'config.json'), join(root, SETUP.config));
  const linked = await repositoryDiagnostics(root, { mode: 'doctor', cliSource: 'plugin' });
  assert.equal(linked.setup.config.state, 'invalid');
  assert.equal(linked.next.includes(SETUP_COMMANDS.init), false);
  assert.equal(linked.check.status, 'notRun');
  await rm(join(root, SETUP.config));
  await put(root, SETUP.config, ' '.repeat(1024 * 1024 + 1));
  const oversized = await repositoryDiagnostics(root, { mode: 'doctor', cliSource: 'plugin' });
  assert.equal(oversized.setup.config.state, 'invalid');
  assert.equal(oversized.check.status, 'notRun');
});

test('a marker without version is a warning and only suggests the existing installer', async (t) => {
  const root = await fixture(t);
  await configured(root);
  await local(root);
  await put(root, SETUP.skills.claude, `<!-- ${SETUP.skillMarker} -->\n`);
  const result = await repositoryDiagnostics(root, { cliVersion: '1.2.3' });
  assert.ok(result.issues.some((entry) => entry.code === 'skill-version-mismatch'));
  assert.ok(result.next.includes(SETUP_COMMANDS.skills));
  assert.equal(diagnosticsExitCode(result), 0);
});

test('invalid plugin settings remain visible without making unused host skills errors', async (t) => {
  const root = await fixture(t);
  await configured(root);
  await local(root);
  await put(root, SETUP.claudeSettings, '{broken');
  const result = await repositoryDiagnostics(root, { cliVersion: '1.2.3' });
  assert.ok(
    result.issues.some(
      (entry) => entry.code === 'plugin-settings-invalid' && entry.severity === 'warning',
    ),
  );
  assert.equal(result.ready, true);
});

test('invalid manifests and missing roots yield diagnostics, not fabricated versions', async (t) => {
  const root = await fixture(t);
  await put(root, 'package.json', '[]');
  await put(
    root,
    `node_modules/${SETUP.packageName}/package.json`,
    JSON.stringify({ name: SETUP.packageName, version: '^1.0.0' }),
  );
  const result = await repositoryDiagnostics(root);
  assert.equal(result.setup.package.state, 'invalid');
  assert.equal(result.package.state, 'invalid');
  assert.equal(result.package.installedVersion, null);
  const absent = await repositoryDiagnostics(join(root, 'does not exist'), { mode: 'doctor' });
  assert.ok(absent.issues.some((entry) => entry.code === 'invalid-root'));
  assert.equal(absent.check.status, 'notRun');
  assert.equal(diagnosticsExitCode(absent), 1);
});
