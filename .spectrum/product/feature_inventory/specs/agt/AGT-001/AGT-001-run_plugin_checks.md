---
interaction_id: "AGT-001-run_plugin_checks"
interaction_type: "command"
feature: "Distribute Spectrum as an agent plugin"
category_key: "AGT"
feature_id: "AGT-001"
status: "implementing"
phase: "now"
summary: "Run the repository-pinned, global or bundled deterministic CLI inside the supported host agent."
related_region: "plugin.spectrum"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Run plugin checks

## Intent

Run the deterministic CLI inside the supported host agent, preferring the version the repository pins.

## Trigger / Entry Points

The host agent loads the Spectrum skill when the user mentions Spectrum or `.spectrum` specs, asks whether specs are valid, asks for a feature's acceptance criteria, or is about to change behavior a spec covers. The skill runs `node <skill base directory>/scripts/spectrum.mjs` with `check|list [repository path] [--profile profile.json]`. That launcher runs the repository's pinned `@voyager-fm/spectrum` when one is found from the working directory up to the Git root, otherwise a global install that identifies as the package and is newer than the bundle, otherwise the bundled CLI. See the [distribution plugin rules](../../../../../contracts/distribution.md).

## Preconditions

The plugin is installed and Node is available. A local repository and a schema_version 2 configuration identify canonical documents and inventory schemas. External service authentication is not required for local reads.

## Expected Outcome

The skill returns the JSON result and exit status of the CLI that ran, and stderr names that CLI and its version. The host agent reads the result and the linked canonical documents before acting.

## State Changes

Canonical repository files stay unchanged. The response contains a derived model for the current read.

## User-visible Feedback

The host agent says which CLI ran and its version, relays version notes, reports concrete paths, IDs, findings and declared states from the result and describes unavailable adapters as planned.

## Edge Cases / Failure Handling

Malformed TSV, JSON schemas, YAML or TOML produce failures. Missing references and symlink escapes produce failures. TBD remains a visible unresolved warning. Missing data is never replaced with a successful sample. A repository without `.spectrum/config.json` is reported as not set up. A `spectrum` on `PATH` that is not the Spectrum package is skipped without being executed. A pinned CLI older than the bundle runs with a version note; when it rejects the invocation with usage status 2, the bundled CLI runs instead. A pinned CLI that started and failed otherwise is not rerun.

## Acceptance Criteria

- [ ] **AC-1:** The plugin installs from this repository's marketplace with no model credentials.
- [ ] **AC-2:** Every product skill passes Agent Skills naming, description, size and reference checks.
- [ ] **AC-3:** Skills run the checked-in CLI bundle, and the build fails when that bundle is stale.
- [ ] **AC-4:** Skills describe only commands the bundled CLI implements.
- [ ] **AC-5:** The plugin runs the same schema_version 2 checks and listing as the workspace CLI.
- [ ] **AC-6:** When the repository pins `@voyager-fm/spectrum` in `node_modules`, pnpm's hidden hoist directory or a Yarn Plug'n'Play project, found from the working directory up to the Git root, the launcher runs that pinned CLI instead of the bundled copy and stderr says which one it ran.
- [ ] **AC-7:** Without a repository pin, a global `spectrum` runs only when its manifest identifies `@voyager-fm/spectrum` and its version is newer than the bundle; otherwise the bundled CLI runs and stderr says why the global one was skipped.
- [ ] **AC-8:** A pinned CLI older than the bundle runs with a stderr note naming both versions; when it rejects the invocation with usage status 2, the bundled CLI runs instead and says so.
- [ ] **AC-9:** Stdout and the exit status are those of the CLI that ran, so JSON results stay machine-readable.

## Permissions / Dependencies

Read-only local inspection is executable. Human review annotations do not grant authority to apply, commit, push, merge or post externally.

## Observability / Analytics

Local JSON findings and process exit status are available to the host agent. Hosted telemetry, model jobs and PR review publication remain unimplemented.

## Related Interactions

- [Check repository](../../val/VAL-001/VAL-001-check_repository.md)
- [List specifications](../../val/VAL-001/VAL-001-list_specifications.md)
- [Install plugin](AGT-001-install_plugin.md)
- [Follow spec guardrails](../AGT-002/AGT-002-follow_spec_guardrails.md)
- [Run repository skill](../../set/SET-003/SET-003-run_repository_skill.md)

## Source

- [Contract](../contracts/distribution.toml)
- [Flow](../flows/distribution.md)
- [Distribution architecture](../../../../../contracts/distribution.md)
