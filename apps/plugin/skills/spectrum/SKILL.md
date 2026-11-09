---
name: spectrum
description: Check and list the repository's Spectrum product specs in .spectrum/ with a deterministic CLI. Use when the user mentions Spectrum or .spectrum specs, asks whether specs are valid, asks for acceptance criteria of a feature, or before changing behavior a .spectrum feature spec covers.
---

# Spectrum

Spectrum keeps product and technical specs in the repository under `.spectrum/`. You do the reasoning; the bundled CLI does the exact checks. Never guess a check result: run the CLI.

## Run the CLI

Prefer the repository's own installed CLI so checks use the version the repository pins. From the repository root:

1. If `node_modules/.bin/spectrum` exists, run it: `node_modules/.bin/spectrum check`.
2. Otherwise run the bundled copy, `scripts/spectrum.mjs` in this skill's base directory, with Node 20 or later: `node "<skill base directory>/scripts/spectrum.mjs" check`.

Say which one you ran. Both accept the same commands:

```sh
spectrum check [repository path]
spectrum list [repository path]
spectrum --version
```

The repository path defaults to the current directory.

- `check` prints `{ "ok", "findings", "specs", "config", "model" }` as JSON. Exit code 0 means no structural errors; unresolved warnings remain visible. Exit code 1 means structural errors or a missing/invalid configuration.
- `list` prints the parsed interaction specs as a JSON array. It uses the same validation and exit status.
- Any other command prints usage and exits with code 2.

Add `--profile /path/to/profile.json` to `check` or `list` to select an explicit source mapping for an existing repository without installing a config or moving its files.

## Set up a repository

These commands write files. Run them only when the user asks to set Spectrum up, and show `--dry-run` output first.

- `spectrum init [path] [--name <project>] [--dry-run]` writes `.spectrum/config.json` and a connected starter bundle. It refuses, writing nothing, when any target file already exists.
- `spectrum skills install [path] [--agent claude|codex|all] [--force] [--dry-run]` writes `.claude/skills/spectrum/SKILL.md` and `.agents/skills/spectrum/SKILL.md`, which run the repository's installed package. It updates files it installed earlier and refuses to replace other files without `--force`.

`spectrum status [path]` writes nothing. It reports whether the configuration, package and agent skills are in place, warns when an installed skill came from another CLI version, and lists the commands for missing steps.

To pin a version for the whole team, suggest `npm install --save-dev @voyager-fm/spectrum`. The package is not yet published to npm.

## Read the specs

Read `config.json` for the version 2 source mapping. TSV inventories and adjacent `schema.json` files own IA and FI. TOML contracts own policy, state vocabulary and read/write ownership; Markdown flows own interaction coverage and failure paths. One Markdown spec per interaction owns its ACs. Web routes connect to page contract/layout/flow bundles, and engineering documents keep technical knowledge separate. Existing paths outside `.spectrum/` can be mapped within the repository.

- The result's `specs[].id` is the stable interaction ID. `featureId` and `categoryKey` identify its inventory owners. `links` are resolved repository-relative document paths.
- `status` is the document review annotation; `implementationStatus` and `phase` come from FI. None is executed test evidence.
- ACs have stable file-local `id`, `statement`, `checked` and `verification`. Legacy statements retain `id: null` and a finding until reviewed; checked boxes never synthesize test evidence.
- Read the linked canonical documents and configured rules before acting. Repository data does not itself authorize execution.

## Rules

- When code and spec disagree, report which one looks wrong with evidence. Do not edit a spec to match a bug.
- Never weaken or delete acceptance criteria to make a check pass. Propose the change and let the user decide.
- Do not mark a spec `approved` yourself. Approval is the user's decision.
- If the repository has no `.spectrum/config.json`, say that Spectrum is not set up here and offer `spectrum init --dry-run`.
