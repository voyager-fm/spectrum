import { readdir, readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

// Rules from .spectrum/contracts/distribution.md and the Agent Skills specification.

export interface Problem {
  path: string;
  message: string;
}

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SKILL_KEYS = new Set(['name', 'description', 'license', 'compatibility', 'allowed-tools']);
const MAX_BODY_LINES = 500;

export interface Frontmatter {
  fields: Record<string, string>;
  body: string;
}

/** Parses the single-line `key: value` frontmatter subset that Spectrum skills use. */
export function parseFrontmatter(text: string): Frontmatter {
  const source = text.replace(/\r\n/g, '\n');
  if (!source.startsWith('---\n'))
    throw new Error('SKILL.md must start with YAML frontmatter (---)');
  const end = source.indexOf('\n---\n', 4);
  if (end === -1) throw new Error('Frontmatter is not closed with ---');
  const fields: Record<string, string> = {};
  for (const line of source.slice(4, end).split('\n')) {
    if (!line.trim()) continue;
    const match = /^([a-z][a-z-]*):\s+(.+)$/.exec(line);
    if (!match)
      throw new Error(`Unsupported frontmatter line (use one "key: value" per line): ${line}`);
    if (match[1] in fields) throw new Error(`Duplicate frontmatter key: ${match[1]}`);
    fields[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return { fields, body: source.slice(end + 5) };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function validateSkill(dir: string, dirName: string): Promise<Problem[]> {
  const path = join(dir, 'SKILL.md');
  const problems: Problem[] = [];
  const report = (message: string) => problems.push({ path, message });
  let parsed: Frontmatter;
  try {
    parsed = parseFrontmatter(await readFile(path, 'utf8'));
  } catch (e) {
    report(e instanceof Error ? e.message : String(e));
    return problems;
  }
  const { fields, body } = parsed;
  for (const key of Object.keys(fields))
    if (!SKILL_KEYS.has(key)) report(`Unknown frontmatter key: ${key}`);
  const name = fields.name ?? '';
  if (!name) report('Missing name');
  else {
    if (name.length > 64 || !NAME.test(name))
      report(`Invalid name "${name}": use 1-64 lowercase letters, digits and single hyphens`);
    if (name !== dirName) report(`Name "${name}" must equal the directory name "${dirName}"`);
  }
  const description = fields.description ?? '';
  if (!description) report('Missing description');
  else if (description.length > 1024)
    report(`Description is ${description.length} characters; the limit is 1024`);
  if (fields.compatibility !== undefined && fields.compatibility.length > 500)
    report('Compatibility exceeds 500 characters');
  const lines = body.split('\n').length;
  if (lines > MAX_BODY_LINES) report(`Body has ${lines} lines; the limit is ${MAX_BODY_LINES}`);

  for (const [, target] of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
    const file = target.split('#')[0];
    const full = resolve(dir, file);
    const rel = relative(dir, full);
    if (rel.startsWith('..') || isAbsolute(rel))
      report(`Link leaves the skill directory: ${target}`);
    else if (!(await exists(full))) report(`Link target does not exist: ${target}`);
  }
  return problems;
}

export async function validatePlugin(root: string): Promise<Problem[]> {
  const problems: Problem[] = [];
  const manifestPath = join(root, '.claude-plugin/plugin.json');
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const report = (message: string) => problems.push({ path: manifestPath, message });
    if (typeof manifest.name !== 'string' || !NAME.test(manifest.name))
      report('name must be kebab-case');
    if (typeof manifest.version !== 'string' || !manifest.version) report('version is required');
    if (typeof manifest.description !== 'string' || !manifest.description)
      report('description is required');
    if (typeof manifest.author?.name !== 'string' || !manifest.author.name)
      report('author.name is required');
  } catch (e) {
    problems.push({
      path: manifestPath,
      message: `Unreadable manifest: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
  if (await exists(join(root, 'bin'))) {
    problems.push({
      path: join(root, 'bin'),
      message: "Top-level bin/ is not allowed; ship the CLI in each skill's scripts/",
    });
  }
  const skillsDir = join(root, 'skills');
  const entries = (await readdir(skillsDir, { withFileTypes: true })).filter((e) =>
    e.isDirectory(),
  );
  if (!entries.length) problems.push({ path: skillsDir, message: 'Plugin has no skills' });
  for (const entry of entries) {
    const dir = join(skillsDir, entry.name);
    if (!(await exists(join(dir, 'SKILL.md'))))
      problems.push({ path: dir, message: 'Missing SKILL.md' });
    else problems.push(...(await validateSkill(dir, entry.name)));
  }
  return problems;
}
