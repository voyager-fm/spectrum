---
interaction_id: "SET-001-install_cli_package"
interaction_type: "command"
feature: "Installable command-line package"
category_key: "SET"
feature_id: "SET-001"
status: "implementing"
phase: "now"
summary: "Pin the packaged CLI in a client repository and run it from the repository's own binary."
related_region: "cli.output"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Install CLI package

## Intent

Pin the deterministic CLI in a client repository, so every contributor, CI job and agent checks specs with the same version, without the plugin or this workspace.

## Trigger / Entry Points

The user adds `@voyager-fm/spectrum` as a development dependency, for example `npm install --save-dev @voyager-fm/spectrum`. They then run `npx --no spectrum <command>` or `node_modules/.bin/spectrum <command>`. Until the package is published, they build a local tarball with `pnpm --filter @voyager-fm/spectrum pack` and install that file.

## Preconditions

Node 20 or later and an npm-compatible package manager. The client repository has a `package.json`.

## Expected Outcome

The package installs one executable, `spectrum`. It is a single bundled script with the specification templates and its version embedded, and it has no runtime dependencies. Its `check`, `list`, `init` and `skills install` commands behave like the workspace CLI. `spectrum --version` prints the package version.

## State Changes

The package manager records the dependency in `package.json` and its lockfile. Installing writes nothing under `.spectrum/`.

## User-visible Feedback

Each command prints JSON on standard output and reports through its exit status. Help and usage text name every command and option.

## Edge Cases / Failure Handling

An unknown command prints usage and exits with status 2. An unknown or repeated option, an option missing its value, or more than one repository path exits with status 1 and does nothing. The unscoped npm package `spectrum` is unrelated, so guidance always uses `npx --no` or the local binary and never a bare `npx spectrum`. Publishing to npm requires explicit approval and has not happened.

## Acceptance Criteria

- [ ] **AC-1:** The packed package contains only the bundled executable, its manifest and README, and declares no runtime dependencies.
- [ ] **AC-2:** Installed into a repository outside this workspace, the `spectrum` binary runs `check`, `list`, `init` and `skills install` from embedded templates.
- [ ] **AC-3:** `spectrum --version` prints the version from the package manifest.
- [ ] **AC-4:** Unknown commands exit with status 2, and invalid options exit with status 1 before any read or write.

## Permissions / Dependencies

Installing needs only package-manager access to the tarball or registry. The CLI makes no network requests and needs no model or service credentials.

## Observability / Analytics

The installed version is visible through `spectrum --version` and the dependency range in `package.json`. No usage telemetry is collected.

## Related Interactions

- [Initialize repository](../SET-002/SET-002-initialize_repository.md)
- [Install repository skills](../SET-003/SET-003-install_repository_skills.md)
- [Check repository](../../val/VAL-001/VAL-001-check_repository.md)

## Source

- [Contract](../contracts/setup.toml)
- [Flow](../flows/setup.md)
- [Distribution architecture](../../../../contracts/distribution.md)
