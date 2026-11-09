import { checkRepository } from '@spectrum/spec-engine';
import {
  defaultProjectName,
  renderStarterBundle,
  SETUP,
  SETUP_COMMANDS,
  SKILL_AGENTS,
  type SkillAgent,
} from '@spectrum/spec-engine/setup';
import { inspectFile, writePlannedFile } from './files.ts';
import { repositorySkill, skillPath } from './skill.ts';

export interface CheckSummary {
  ok: boolean;
  errors: number;
  warnings: number;
}

export interface InitResult {
  ok: boolean;
  dryRun: boolean;
  /** Files written, or that would be written with `--dry-run`. */
  files: string[];
  /** Existing paths that block initialization; nothing is written when any exist. */
  conflicts: string[];
  check: CheckSummary | null;
  next: string[];
}

async function summarize(root: string): Promise<CheckSummary> {
  const result = await checkRepository(root);
  const errors = result.findings.filter((finding) => finding.severity === 'error').length;
  return { ok: result.ok, errors, warnings: result.findings.length - errors };
}

/**
 * Write the starter bundle into a repository without `.spectrum/config.json`. All-or-nothing:
 * any existing target path blocks the whole write, and no existing file is overwritten.
 */
export async function initRepository(
  root: string,
  options: { name?: string; dryRun?: boolean } = {},
): Promise<InitResult> {
  const files = await renderStarterBundle(options.name ?? defaultProjectName(root));
  const conflicts: string[] = [];
  for (const file of files)
    if ((await inspectFile(root, file.path)).kind !== 'missing') conflicts.push(file.path);
  const dryRun = Boolean(options.dryRun);
  const paths = files.map((file) => file.path);
  if (conflicts.length)
    return {
      ok: false,
      dryRun,
      files: [],
      conflicts,
      check: null,
      next: conflicts.includes(SETUP.config)
        ? [`Spectrum is already initialized; run ${SETUP_COMMANDS.check}`]
        : ['Move or remove the conflicting paths, or map existing documents with --profile'],
    };
  if (dryRun) return { ok: true, dryRun, files: paths, conflicts, check: null, next: [] };
  for (const file of files) await writePlannedFile(root, file, 'create');
  return {
    ok: true,
    dryRun,
    files: paths,
    conflicts,
    check: await summarize(root),
    next: [
      'Replace TBD values and the CORE starter records with your product',
      SETUP_COMMANDS.skills,
      SETUP_COMMANDS.check,
    ],
  };
}

export type SkillOutcome = 'created' | 'updated' | 'unchanged' | 'conflict';
export interface SkillsResult {
  ok: boolean;
  dryRun: boolean;
  skills: { agent: SkillAgent; path: string; outcome: SkillOutcome; reason?: string }[];
}

/** Parse `--agent claude|codex|all`. */
export function parseAgents(value: string | undefined): SkillAgent[] {
  if (value === undefined || value === 'all') return [...SKILL_AGENTS];
  if ((SKILL_AGENTS as string[]).includes(value)) return [value as SkillAgent];
  throw new Error(`--agent must be one of ${[...SKILL_AGENTS, 'all'].join(', ')}.`);
}

/**
 * Install the Spectrum agent skill for each agent. A file Spectrum installed earlier is
 * updated in place; a file it did not install is a conflict unless `force` is set, and any
 * conflict writes nothing.
 */
export async function installSkills(
  root: string,
  version: string,
  options: { agents?: SkillAgent[]; force?: boolean; dryRun?: boolean } = {},
): Promise<SkillsResult> {
  const content = repositorySkill(version);
  const dryRun = Boolean(options.dryRun);
  const skills: SkillsResult['skills'] = [];
  for (const agent of options.agents ?? SKILL_AGENTS) {
    const path = skillPath(agent);
    const existing = await inspectFile(root, path);
    let outcome: SkillOutcome;
    let reason: string | undefined;
    if (existing.kind === 'missing') outcome = 'created';
    else if (existing.kind === 'other') {
      outcome = 'conflict';
      reason = 'a link or directory occupies the path';
    } else if (existing.content === content) outcome = 'unchanged';
    else if (existing.content.includes(SETUP.skillMarker) || options.force) outcome = 'updated';
    else {
      outcome = 'conflict';
      reason = 'the file was not installed by Spectrum; pass --force to replace it';
    }
    skills.push(reason ? { agent, path, outcome, reason } : { agent, path, outcome });
  }
  const ok = skills.every((skill) => skill.outcome !== 'conflict');
  // All-or-nothing like init: a conflict for one agent leaves every skill untouched.
  if (ok && !dryRun)
    for (const { path, outcome } of skills)
      if (outcome === 'created' || outcome === 'updated')
        await writePlannedFile(
          root,
          { path, content },
          outcome === 'created' ? 'create' : 'replace',
        );
  return { ok, dryRun, skills };
}
