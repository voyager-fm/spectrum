---
interaction_id: "SP-004-run_plugin_checks"
interaction_type: "command"
feature: "Distribute Spectrum as an agent plugin"
category_key: "SP"
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

The user runs the check or list command through the CLI or the Spectrum host skill.

## Preconditions

A local repository and a schema_version 2 configuration identify canonical documents and inventory schemas. External service authentication is not required for local reads.

## Expected Outcome

Return the requested repository data and structural findings from the shared deterministic engine.

## State Changes

Canonical repository files stay unchanged. The response contains a derived model for the current read.

## User-visible Feedback

Show concrete document paths, IDs, findings and declared states. Describe unavailable adapters as planned.

## Edge Cases / Failure Handling

Malformed TSV, JSON schemas, YAML or TOML produce failures. Missing references and symlink escapes produce failures. TBD remains a visible unresolved warning. Missing data is never replaced with a successful sample.

## Acceptance Criteria

- [ ] **AC-1:** The plugin installs from this repository's marketplace with no model credentials.
- [ ] **AC-2:** Every product skill passes Agent Skills naming, description, size and reference checks.
- [ ] **AC-3:** Skills run the checked-in CLI bundle, and the build fails when that bundle is stale.
- [ ] **AC-4:** Skills describe only commands the bundled CLI implements.
- [ ] **AC-5:** The plugin runs the same schema_version 2 checks and listing as the workspace CLI.

## Permissions / Dependencies

Read-only local inspection is executable. Human review annotations do not grant authority to apply, commit, push, merge or post externally.

## Observability / Analytics

Local JSON findings and process exit status are available. Hosted telemetry, model jobs and PR review publication remain unimplemented.

## Related Interactions

- [Check repository](../SP-001/SP-001-check_repository.md)
- [List specifications](../SP-001/SP-001-list_specifications.md)
- [Browse specifications](../SP-002/SP-002-browse_specifications.md)
- [Review proposal](../SP-003/SP-003-review_proposal.md)

## Source

- [Contract](../contracts/distribution.toml)
- [Flow](../flows/distribution.md)
- [Distribution architecture](../../../../contracts/distribution.md)
