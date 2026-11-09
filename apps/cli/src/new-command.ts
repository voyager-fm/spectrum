import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve, win32 } from 'node:path';
import { loadTemplate, renderTemplate, type TemplateValues } from '@spectrum/spec-engine/templates';
import { inspectFile, type PlannedFile, writePlannedFile } from './files.ts';

const aliases = new Map<string, readonly string[]>([
  ['interaction', ['feature.interaction']],
  ['contract', ['feature.contract']],
  ['flow', ['feature.flow']],
  ['adr', ['engineering.adr']],
  ['feature', ['feature.interaction', 'feature.contract', 'feature.flow']],
]);

/** Inspect the canonical draft inputs before creating a values file. Writes nothing. */
export async function describeDraft(kind: string) {
  const templates = await Promise.all((aliases.get(kind) ?? [kind]).map((id) => loadTemplate(id)));
  const requiredValues = new Set<string>();
  for (const template of templates)
    for (const match of `${template.output}\n${template.content}`.matchAll(
      /\{\{(?:text|json|tsv|path):([a-z_]+)\}\}/g,
    ))
      requiredValues.add(match[1]);
  return { templates, requiredValues: [...requiredValues].sort(), writes: false };
}

export interface NewDraftOptions {
  /** Explicit caller-supplied values; this command supplies no product defaults. */
  values: unknown;
  /** Repository-relative single-file destination; bundles cannot override it. */
  out?: string;
  dryRun?: boolean;
}

export interface NewDraftResult {
  /** Creation/preflight outcome, not repository validation or approval. */
  ok: boolean;
  dryRun: boolean;
  templates: string[];
  /** Complete plan, including content, even for dry runs and known conflicts. */
  files: PlannedFile[];
  /** Files actually created; empty for dry runs and known preflight conflicts. */
  created: string[];
  /** Planned destinations blocked by an existing file, directory or ancestor link. */
  conflicts: string[];
  check: null;
  next: string[];
}

function stringValues(value: unknown): TemplateValues {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    !Object.values(value).every((entry) => typeof entry === 'string')
  )
    throw new Error('Template values must be a JSON object containing only string values.');
  return Object.fromEntries(Object.entries(value));
}

/** Read a user-selected values file. Resolution is relative to the caller's cwd. */
export async function readTemplateValues(path: string): Promise<TemplateValues> {
  const source = await readFile(path, 'utf8');
  let values: unknown;
  try {
    values = JSON.parse(source);
  } catch {
    throw new Error(`Template values file must contain valid JSON: ${path}`);
  }
  return stringValues(values);
}

function pathParts(path: string): string[] {
  const parts = path.split('/');
  if (
    !path ||
    path.includes('\0') ||
    path.includes('\\') ||
    isAbsolute(path) ||
    win32.isAbsolute(path) ||
    parts.some((part) => part === '' || part === '.' || part === '..')
  )
    throw new Error(`Draft output must be a normalized repository-relative file path: ${path}`);
  return parts;
}

/** Preflight known obstructions without following links or creating directories. */
async function hasConflict(root: string, file: PlannedFile): Promise<boolean> {
  let ancestor = root;
  for (const part of pathParts(file.path).slice(0, -1)) {
    ancestor = join(ancestor, part);
    try {
      const stat = await lstat(ancestor);
      // Reject even internal ancestor links: draft creation does not choose link targets.
      if (!stat.isDirectory()) return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }
  return (await inspectFile(root, file.path)).kind !== 'missing';
}

/**
 * Render canonical draft documents and optionally create them with exclusive writes.
 * Known conflicts block the entire plan. Writes are sequential, not an OS transaction:
 * concurrent changes or I/O failures can still interrupt a partially created bundle.
 */
export async function createDraft(
  root: string,
  kind: string,
  options: NewDraftOptions,
): Promise<NewDraftResult> {
  const templates = [...(aliases.get(kind) ?? [kind])];
  if (templates.length > 1 && options.out !== undefined)
    throw new Error('--out is supported only for a single template, not a feature draft bundle.');
  const values = stringValues(options.values);
  // Render everything before touching any destination; missing values cannot create a partial plan.
  const files: PlannedFile[] = [];
  for (const id of templates) {
    const rendered = await renderTemplate(id, values);
    const file = { path: options.out ?? rendered.path, content: rendered.content };
    pathParts(file.path);
    files.push(file);
  }
  if (new Set(files.map((file) => file.path)).size !== files.length)
    throw new Error('Canonical templates produced duplicate draft destinations.');

  const base = await realpath(resolve(root));
  if (!(await lstat(base)).isDirectory())
    throw new Error('The repository root must be a directory.');
  const conflicts: string[] = [];
  for (const file of files) if (await hasConflict(base, file)) conflicts.push(file.path);
  const dryRun = Boolean(options.dryRun);
  const created: string[] = [];
  if (!dryRun && !conflicts.length) {
    for (const file of files) {
      await writePlannedFile(base, file, 'create');
      created.push(file.path);
    }
  }
  return {
    ok: conflicts.length === 0,
    dryRun,
    templates,
    files,
    created,
    conflicts,
    check: null,
    next: [
      ...(conflicts.length
        ? ['Choose unused destinations; existing files and links are never overwritten.']
        : []),
      'These are draft documents, not an approved or implemented feature; no validation was run.',
      'Review the supplied values and related inventory records; generation does not update inventories or configuration.',
      'Reconcile catalog destinations and document links with your actual configuration/profile mappings before running spectrum check.',
    ],
  };
}
