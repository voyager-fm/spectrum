import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { after, describe, it } from 'node:test';
import { extractSnapshot, SnapshotError } from './snapshot.ts';

const work = await mkdtemp(join(tmpdir(), 'spectrum-snapshot-test-'));
after(() => rm(work, { recursive: true, force: true }));

/** Build a tarball shaped like GitHub's: one `<owner>-<repo>-<sha>/` top-level directory. */
async function githubTarball(name: string, files: Record<string, string>, links = {}) {
  const source = join(work, `${name}-src`);
  const top = join(source, 'voyager-fm-spectrum-abc1234');
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(top, path, '..'), { recursive: true });
    await writeFile(join(top, path), content);
  }
  for (const [path, target] of Object.entries(links as Record<string, string>)) {
    await symlink(target, join(top, path));
  }
  const archive = join(work, `${name}.tar.gz`);
  execFileSync('tar', ['-czf', archive, '-C', source, 'voyager-fm-spectrum-abc1234']);
  return archive;
}

describe('extractSnapshot', () => {
  it('extracts to the single top-level directory and removes it on dispose', async () => {
    const archive = await githubTarball('basic', {
      '.spectrum/config.json': '{}',
      'README.md': '# Fixture',
    });
    const snapshot = await extractSnapshot(createReadStream(archive));
    assert.match(snapshot.root, /voyager-fm-spectrum-abc1234$/);
    assert.equal(await readFile(join(snapshot.root, '.spectrum/config.json'), 'utf8'), '{}');
    await snapshot.dispose();
    await assert.rejects(access(snapshot.root));
    await snapshot.dispose();
  });

  it('keeps symlinks as links so the spec reader can refuse external targets', async () => {
    const archive = await githubTarball('links', { 'README.md': 'x' }, { escape: '/etc/hosts' });
    const snapshot = await extractSnapshot(createReadStream(archive));
    try {
      const { readlink } = await import('node:fs/promises');
      assert.equal(await readlink(join(snapshot.root, 'escape')), '/etc/hosts');
    } finally {
      await snapshot.dispose();
    }
  });

  it('aborts the extraction past the byte cap', async () => {
    const archive = await githubTarball('large', { 'big.txt': 'x'.repeat(200_000) });
    await assert.rejects(
      extractSnapshot(createReadStream(archive, { highWaterMark: 1024 }), { maxBytes: 64 }),
      (error: unknown) => error instanceof SnapshotError && error.code === 'too-large',
    );
  });

  it('reports a corrupt archive as an extraction failure', async () => {
    await assert.rejects(
      extractSnapshot(Readable.from([Buffer.from('not a tarball')])),
      (error: unknown) => error instanceof SnapshotError && error.code === 'extract-failed',
    );
  });
});
