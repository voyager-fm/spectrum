---
interaction_id: "SET-002-initialize_repository"
interaction_type: "command"
feature: "Repository initialization"
category_key: "SET"
feature_id: "SET-002"
status: "implementing"
phase: "now"
summary: "Write a configuration and connected starter bundle into a repository without overwriting any existing path."
related_region: "cli.output"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Initialize repository

## Intent

Give a repository without Spectrum a valid starting point: a schema_version 2 configuration and one connected example of every default document kind. People then replace the example instead of assembling the format by hand.

## Trigger / Entry Points

`spectrum init [repository path] [--name <project>] [--dry-run]`. The path defaults to the current directory, and the project name defaults to the directory name. The skills offer `--dry-run` when a repository has no configuration, and run `init` only when the user asks.

## Preconditions

The target directory exists, and none of the starter paths exists in it.

## Expected Outcome

The command renders the starter bundle from the shipped template catalog and writes it. The bundle contains the configuration, overview, rules, a feature_inventory catalog with its FI, IA and route tables, one feature bundle, one surface bundle and an engineering root. It contains no copy of the engine's JSON schemas; rendered JSON files reference them by URL. It then runs the checker and reports the files, a check summary and next steps. The written repository passes `spectrum check`.

## State Changes

New files under `.spectrum/` only. No existing file changes. `--dry-run` writes nothing.

## User-visible Feedback

JSON with `ok`, `dryRun`, `files`, `conflicts`, a `check` summary of errors and warnings, and `next` commands. Values Spectrum cannot know are `TBD`, and the check reports them as warnings.

## Edge Cases / Failure Handling

Initialization is all-or-nothing. If any starter path already exists, including `.spectrum/config.json`, the command lists every conflict, writes nothing and exits with status 1. It refuses a target path or ancestor that resolves outside the repository through a link. A project name with a line break or tab is rejected. An existing repository whose documents live elsewhere is mapped with `--profile` instead.

## Acceptance Criteria

- [ ] **AC-1:** `init` in an empty repository writes the starter bundle, and `spectrum check` then passes with undecided values reported as warnings.
- [ ] **AC-2:** `--dry-run` reports the same file list and writes nothing.
- [ ] **AC-3:** When any starter path exists, `init` lists the conflicts, writes nothing and exits with status 1.
- [ ] **AC-4:** `init` never writes outside the repository root or through a link that leaves it.
- [ ] **AC-5:** The starter contains no approval, review status other than draft, or recorded AC evidence.

## Permissions / Dependencies

Writes to the local working tree only; it does not commit, push or publish. The starter grants no approval: document review status stays `draft`, and AC verification stays `not_recorded`.

## Observability / Analytics

The JSON result and exit status are the only record. Adoption is not tracked.

## Related Interactions

- [Install CLI package](../SET-001/SET-001-install_cli_package.md)
- [Install repository skills](../SET-003/SET-003-install_repository_skills.md)
- [Check with a source profile](../../val/VAL-002/VAL-002-check_with_profile.md)

## Source

- [Contract](../contracts/setup.toml)
- [Flow](../flows/setup.md)
- [Distribution architecture](../../../../../contracts/distribution.md)
