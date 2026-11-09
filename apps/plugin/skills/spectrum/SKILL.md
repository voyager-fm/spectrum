---
name: spectrum
description: Check and list the repository's Spectrum product specs in .spectrum/ with a deterministic CLI. Use when the user mentions Spectrum or .spectrum specs, asks whether specs are valid, asks for acceptance criteria of a feature, or before changing behavior a .spectrum feature spec covers.
---

# Spectrum

Spectrum keeps product and technical specs in the repository under `.spectrum/`. You do the reasoning; the bundled CLI does the exact checks. Never guess a check result: run the CLI.

## Run the CLI

The CLI is `scripts/spectrum.mjs` in this skill's base directory. Run it with Node 20 or later from the repository root:

```sh
node "<skill base directory>/scripts/spectrum.mjs" check [repository path]
node "<skill base directory>/scripts/spectrum.mjs" list [repository path]
```

The repository path defaults to the current directory.

- `check` prints `{ "ok", "findings", "specs", "config", "model" }` as JSON. Exit code 0 means no structural errors; unresolved warnings remain visible. Exit code 1 means structural errors or a missing/invalid configuration.
- `list` prints the parsed interaction specs as a JSON array. It uses the same validation and exit status.
- Any other command prints usage and exits with code 2.

Add `--profile /path/to/profile.json` to either command to select an explicit source mapping for an existing repository without installing a config or moving its files.

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
- If the repository has no `.spectrum/config.json`, say that Spectrum is not set up here.
