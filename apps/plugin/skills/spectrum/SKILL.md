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

- `check` prints `{ "ok", "findings", "specs" }` as JSON. Exit code 0 means no findings. Exit code 1 means findings or an error such as a missing `.spectrum/config.json`.
- `list` prints the feature specs as a JSON array.
- Any other command prints usage and exits with code 2.

Finding codes: `invalid-spec`, `duplicate-id`, `broken-link`, `unsafe-link`, `empty-specs`.

## Read the specs

Feature specs are `.spectrum/features/SP-*.json` with `id`, `title`, `status`, `acceptance` and `links`. Links point to shared documents in `.spectrum/` such as `contracts/`, `flows/` and `rules/`. Read the linked documents before acting on a spec.

- `status` is the document review state (`draft` or `approved`). It says nothing about whether the behavior is implemented or tested.
- Follow `.spectrum/rules/*.md` when present.

## Rules

- When code and spec disagree, report which one looks wrong with evidence. Do not edit a spec to match a bug.
- Never weaken or delete acceptance criteria to make a check pass. Propose the change and let the user decide.
- Do not mark a spec `approved` yourself. Approval is the user's decision.
- If the repository has no `.spectrum/config.json`, say that Spectrum is not set up here.
