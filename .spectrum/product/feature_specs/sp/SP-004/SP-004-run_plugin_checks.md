---
interaction_id: "SP-004-run_plugin_checks"
interaction_type: "command"
feature: "Distribute Spectrum as an agent plugin"
category_key: "AGT"
feature_id: "SP-004"
status: "implementing"
phase: "now"
summary: "Run the bundled deterministic CLI inside the supported host agent."
related_region: "plugin.spectrum"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Run plugin checks

## Intent

Run the bundled deterministic CLI inside the supported host agent.

## Trigger / Entry Points

The host agent loads the Spectrum skill when the user mentions Spectrum or `.spectrum` specs, asks whether specs are valid, asks for a feature's acceptance criteria, or is about to change behavior a spec covers. The skill runs `node <skill base directory>/scripts/spectrum.mjs check|list [repository path] [--profile profile.json]`.

## Preconditions

The plugin is installed and Node is available. A local repository and a schema_version 2 configuration identify canonical documents and inventory schemas. External service authentication is not required for local reads.

## Expected Outcome

The skill returns the same JSON result and exit status as the workspace CLI. The host agent reads the result and the linked canonical documents before acting.

## State Changes

Canonical repository files stay unchanged. The response contains a derived model for the current read.

## User-visible Feedback

The host agent reports concrete paths, IDs, findings and declared states from the result and describes unavailable adapters as planned.

## Edge Cases / Failure Handling

Malformed TSV, JSON schemas, YAML or TOML produce failures. Missing references and symlink escapes produce failures. TBD remains a visible unresolved warning. Missing data is never replaced with a successful sample. A repository without `.spectrum/config.json` is reported as not set up.

## Acceptance Criteria

- [ ] **AC-1:** The plugin installs from this repository's marketplace with no model credentials.
- [ ] **AC-2:** Every product skill passes Agent Skills naming, description, size and reference checks.
- [ ] **AC-3:** Skills run the checked-in CLI bundle, and the build fails when that bundle is stale.
- [ ] **AC-4:** Skills describe only commands the bundled CLI implements.
- [ ] **AC-5:** The plugin runs the same schema_version 2 checks and listing as the workspace CLI.

## Permissions / Dependencies

Read-only local inspection is executable. Human review annotations do not grant authority to apply, commit, push, merge or post externally.

## Observability / Analytics

Local JSON findings and process exit status are available to the host agent. Hosted telemetry, model jobs and PR review publication remain unimplemented.

## Related Interactions

- [Check repository](../SP-001/SP-001-check_repository.md)
- [List specifications](../SP-001/SP-001-list_specifications.md)
- [Install plugin](../SP-004/SP-004-install_plugin.md)
- [Follow spec guardrails](../SP-008/SP-008-follow_spec_guardrails.md)

## Source

- [Contract](../contracts/distribution.toml)
- [Flow](../flows/distribution.md)
- [Distribution architecture](../../../../contracts/distribution.md)
