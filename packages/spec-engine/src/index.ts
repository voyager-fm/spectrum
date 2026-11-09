import { readFile, readdir, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import type { CheckResult, Finding, Spec } from '@spectrum/core';
export async function checkRepository(root: string): Promise<CheckResult> {
  const base = await realpath(root);
  const findings: Finding[] = [];
  const specs: Spec[] = [];
  const config = JSON.parse(
    await readFile(resolve(base, '.spectrum/config.json'), 'utf8'),
  );
  if (config.schemaVersion !== 1)
    throw new Error('Unsupported Spectrum schemaVersion');
  if (config.specRoot !== 'features')
    throw new Error('Only the features specRoot is supported in this scaffold');
  const dir = resolve(base, '.spectrum/features');
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const path = '.spectrum/features/' + entry.name;
    try {
      const raw = JSON.parse(await readFile(resolve(base, path), 'utf8'));
      if (
        typeof raw.id !== 'string' ||
        !/^SP-[0-9]{3}$/.test(raw.id) ||
        typeof raw.title !== 'string' ||
        !raw.title.trim() ||
        !['draft', 'approved'].includes(raw.status) ||
        !Array.isArray(raw.acceptance) ||
        raw.acceptance.length === 0 ||
        !raw.acceptance.every(
          (s: unknown) => typeof s === 'string' && s.trim(),
        ) ||
        !Array.isArray(raw.links) ||
        !raw.links.every((s: unknown) => typeof s === 'string')
      )
        throw new Error('Invalid spec shape');
      const spec: Spec = { ...raw, path };
      specs.push(spec);
      for (const link of spec.links) {
        const target = resolve(base, '.spectrum', link);
        const rel = relative(resolve(base, '.spectrum'), target);
        if (rel.startsWith('..') || isAbsolute(rel)) {
          findings.push({ code: 'unsafe-link', message: link, path });
          continue;
        }
        try {
          const actual = await realpath(target);
          const inside = relative(resolve(base, '.spectrum'), actual);
          if (inside.startsWith('..') || isAbsolute(inside))
            throw new Error('Link escapes spec directory');
        } catch {
          findings.push({ code: 'broken-link', message: link, path });
        }
      }
    } catch (e) {
      findings.push({ code: 'invalid-spec', message: String(e), path });
    }
  }
  const ids = new Set<string>();
  for (const spec of specs) {
    if (ids.has(spec.id))
      findings.push({
        code: 'duplicate-id',
        message: spec.id,
        path: spec.path,
      });
    ids.add(spec.id);
  }
  if (!specs.length)
    findings.push({
      code: 'empty-specs',
      message: 'No feature specs found',
      path: '.spectrum/features',
    });
  return { ok: findings.length === 0, findings, specs };
}
