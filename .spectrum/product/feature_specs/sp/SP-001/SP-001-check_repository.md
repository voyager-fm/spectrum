---
interaction_id: "SP-001-check_repository"
interaction_type: "command"
feature: "Repository specification validation"
category_key: "SP"
feature_id: "SP-001"
status: "implementing"
phase: "now"
summary: "Validate canonical inventories, documents and their references without writing."
related_region: "cli.output"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Check repository

## Intent

Validate canonical inventories, documents and their references without writing.

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

- [ ] **AC-1:** CLI loads .spectrum/config.json and feature specs.
- [ ] **AC-2:** Duplicate IDs, malformed specs and missing local links fail validation.
- [ ] **AC-3:** Validation never edits the repository.
- [ ] **AC-4:** CLI reads schema_version 2 TSV inventories, TOML contracts and Markdown specifications through the configured repository-relative paths.
- [ ] **AC-5:** Schema constraints, foreign keys, FI/frontmatter consistency, ownership IDs and flow coverage produce actionable findings.
- [ ] **AC-6:** Markdown owns stable file-local AC IDs; checked boxes do not produce passed test evidence.

## Permissions / Dependencies

Read-only local inspection is executable. Human review annotations do not grant authority to apply, commit, push, merge or post externally.

## Observability / Analytics

Local JSON findings and process exit status are available. Hosted telemetry, model jobs and PR review publication remain unimplemented.

## Related Interactions

- [List specifications](../SP-001/SP-001-list_specifications.md)
- [Browse specifications](../SP-002/SP-002-browse_specifications.md)
- [Review proposal](../SP-003/SP-003-review_proposal.md)
- [Run plugin checks](../SP-004/SP-004-run_plugin_checks.md)

## Source

- [Contract](../contracts/validation.toml)
- [Flow](../flows/validation.md)
