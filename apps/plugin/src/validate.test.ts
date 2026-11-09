import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { parseFrontmatter, validatePlugin, validateSkill } from './validate.ts';

const pluginRoot = resolve(import.meta.dirname, '..');

async function withSkill(
  name: string,
  text: string,
  fn: (dir: string) => Promise<void>,
  files: Record<string, string> = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'spectrum-plugin-'));
  const dir = join(root, name);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'SKILL.md'), text);
    for (const [path, body] of Object.entries(files)) {
      await mkdir(join(dir, path, '..'), { recursive: true });
      await writeFile(join(dir, path), body);
    }
    await fn(dir);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const skill = (front: string, body = 'Body\n') => `---\n${front}\n---\n${body}`;
const messages = async (dir: string, name: string) =>
  (await validateSkill(dir, name)).map((p) => p.message);

test('the shipped plugin passes validation', async () => {
  assert.deepEqual(await validatePlugin(pluginRoot), []);
});

test('frontmatter parsing strips quotes and rejects nested YAML', () => {
  assert.deepEqual(
    parseFrontmatter(skill('name: a\ndescription: "Does x."')).fields,
    { name: 'a', description: 'Does x.' },
  );
  assert.throws(
    () => parseFrontmatter(skill('metadata:\n  author: x')),
    /Unsupported frontmatter line/,
  );
  assert.throws(() => parseFrontmatter('# no frontmatter'), /must start/);
});

test('name must be kebab-case and match the directory', async () => {
  await withSkill(
    'good-skill',
    skill('name: Bad--Name\ndescription: x'),
    async (dir) => {
      const m = await messages(dir, 'good-skill');
      assert.ok(m.some((x) => x.startsWith('Invalid name')));
      assert.ok(m.some((x) => x.includes('must equal the directory name')));
    },
  );
});

test('description is required and limited to 1024 characters', async () => {
  await withSkill('s', skill('name: s'), async (dir) => {
    assert.ok((await messages(dir, 's')).includes('Missing description'));
  });
  await withSkill(
    's',
    skill(`name: s\ndescription: ${'x'.repeat(1025)}`),
    async (dir) => {
      assert.ok(
        (await messages(dir, 's')).some((x) => x.includes('limit is 1024')),
      );
    },
  );
});

test('unknown keys, long bodies and bad links are reported', async () => {
  const body = `[ok](references/a.md) [web](https://example.com) [gone](missing.md) [out](../x.md)\n${'line\n'.repeat(500)}`;
  await withSkill(
    's',
    skill('name: s\ndescription: x\nfoo: bar', body),
    async (dir) => {
      const m = await messages(dir, 's');
      assert.ok(m.includes('Unknown frontmatter key: foo'));
      assert.ok(m.some((x) => x.startsWith('Body has')));
      assert.ok(m.includes('Link target does not exist: missing.md'));
      assert.ok(m.includes('Link leaves the skill directory: ../x.md'));
      assert.ok(
        !m.some(
          (x) => x.includes('references/a.md') || x.includes('example.com'),
        ),
      );
    },
    { 'references/a.md': '# A\n' },
  );
});
