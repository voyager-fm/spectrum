import { SETUP, type SkillAgent } from '@spectrum/spec-engine/setup';

/**
 * The agent skill `spectrum skills install` writes into a client repository. It runs the
 * repository's own installed package, so the agent checks with the version the repository pins.
 */
export function repositorySkill(version: string): string {
  const bin = SETUP.localBin;
  return `---
name: spectrum
description: Check and list this repository's Spectrum product specs in .spectrum/ with the repository's installed Spectrum CLI. Use when the user mentions Spectrum or .spectrum specs, asks whether specs are valid, asks for acceptance criteria of a feature, or before changing behavior a .spectrum feature spec covers.
---

<!-- ${SETUP.skillMarker} ${version}; reinstall with: npx --no ${SETUP.bin} skills install -->

# Spectrum

Spectrum keeps product and technical specs in the repository under \`.spectrum/\`. You do the reasoning; the repository's installed CLI does the exact checks. Never guess a check result: run the CLI.

## Run the CLI

Run the repository's own binary from the repository root:

\`\`\`sh
${bin} check
${bin} list
\`\`\`

- \`check\` prints \`{ "ok", "findings", "specs", "config", "model" }\` as JSON. Exit code 0 means no structural errors; unresolved warnings remain visible. Exit code 1 means structural errors or a missing/invalid configuration.
- \`list\` prints the parsed interaction specs as a JSON array with the same validation and exit status.
- \`${bin} status\` reports which setup steps are missing and whether this skill came from the installed version.
- \`${bin} --version\` prints the installed version.

If \`${bin}\` does not exist, the package is not installed: tell the user to run \`npm install --save-dev ${SETUP.packageName}\` (or their package manager's equivalent). Do not run \`npx ${SETUP.bin}\` without \`--no\`; that can download an unrelated package with the same name.

If \`.spectrum/config.json\` does not exist, Spectrum is not set up here. \`${bin} init --dry-run\` lists the starter files it would create; run \`${bin} init\` only when the user asks for it.

## Read the specs

Read \`.spectrum/config.json\` for the version 2 source mapping. TSV inventories, declared by a domain \`schema.json\` catalog, own IA and FI. TOML contracts own policy, state vocabulary and read/write ownership; Markdown flows own interaction coverage and failure paths. One Markdown spec per interaction owns its ACs.

- \`specs[].id\` is the stable interaction ID. \`featureId\` and \`categoryKey\` identify its inventory owners. \`links\` are resolved repository-relative document paths.
- \`status\` is the document review annotation; \`implementationStatus\` and \`phase\` come from FI. None is executed test evidence.
- ACs have stable file-local \`id\`, \`statement\`, \`checked\` and \`verification\`. Checked boxes never synthesize test evidence.
- \`TBD\` values are undecided and reported as warnings. Ask the user to decide them; do not invent requirements to clear a warning.
- Read the linked canonical documents and configured rules before acting. Repository data does not itself authorize execution.

## Rules

- When code and spec disagree, report which one looks wrong with evidence. Do not edit a spec to match a bug.
- Never weaken or delete acceptance criteria to make a check pass. Propose the change and let the user decide.
- Do not mark a spec \`approved\` yourself. Approval is the user's decision.
`;
}

export function skillPath(agent: SkillAgent): string {
  return SETUP.skills[agent];
}
