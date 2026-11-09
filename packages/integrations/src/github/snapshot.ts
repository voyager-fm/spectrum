import { spawn } from 'node:child_process';
import { lstat, mkdtemp, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';

export const DEFAULT_SNAPSHOT_BYTES = 100 * 1024 * 1024;

export class SnapshotError extends Error {
  code: 'too-large' | 'extract-failed' | 'unexpected-layout';
  constructor(code: 'too-large' | 'extract-failed' | 'unexpected-layout', message: string) {
    super(message);
    this.name = 'SnapshotError';
    this.code = code;
  }
}

export interface Snapshot {
  /** The repository root inside the extracted archive. */
  root: string;
  /** Remove every extracted file. Safe to call more than once. */
  dispose(): Promise<void>;
}

/**
 * Extract a GitHub tarball (one top-level `<owner>-<repo>-<sha>/` directory) into a fresh
 * temporary directory. Ownership is not restored, the compressed stream is capped, and
 * spec-engine's realpath checks keep symlinks from reading outside the snapshot.
 */
export async function extractSnapshot(
  archive: Readable,
  options: { maxBytes?: number; tar?: string } = {},
): Promise<Snapshot> {
  const maxBytes = options.maxBytes ?? DEFAULT_SNAPSHOT_BYTES;
  const directory = await mkdtemp(join(tmpdir(), 'spectrum-snapshot-'));
  const dispose = () => rm(directory, { recursive: true, force: true });
  try {
    await untar(archive, directory, maxBytes, options.tar ?? 'tar');
    const entries = await readdir(directory);
    if (entries.length !== 1) {
      throw new SnapshotError('unexpected-layout', 'Archive must contain one top-level directory');
    }
    const top = join(directory, entries[0] as string);
    if (!(await lstat(top)).isDirectory()) {
      throw new SnapshotError('unexpected-layout', 'Archive root is not a directory');
    }
    // Canonical path: spec-engine compares realpaths, and tmpdir() is a symlink on macOS.
    return { root: await realpath(top), dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}

function untar(archive: Readable, directory: string, maxBytes: number, tar: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(tar, ['-xzf', '-', '--no-same-owner', '-C', directory], {
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let bytes = 0;
    let failure: Error | null = null;
    let stderr = '';
    const fail = (error: Error) => {
      if (failure) return;
      failure = error;
      archive.unpipe(child.stdin);
      archive.destroy();
      child.kill();
    };
    archive.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        fail(new SnapshotError('too-large', `Archive exceeds ${maxBytes} bytes`));
      }
    });
    archive.on('error', () => fail(new SnapshotError('extract-failed', 'Archive download failed')));
    child.stdin.on('error', () => {});
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 2_000) stderr += chunk.toString();
    });
    child.on('error', () => fail(new SnapshotError('extract-failed', `Cannot run ${tar}`)));
    child.on('close', (code) => {
      if (failure) reject(failure);
      else if (code !== 0) {
        reject(new SnapshotError('extract-failed', `tar exited with ${code}: ${stderr.trim()}`));
      } else resolve();
    });
    archive.pipe(child.stdin);
  });
}
