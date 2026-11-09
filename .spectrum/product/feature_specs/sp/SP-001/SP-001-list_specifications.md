---
interaction_id: "SP-001-list_specifications"
interaction_type: "command"
feature: "Repository specification validation"
category_key: "VAL"
feature_id: "SP-001"
status: "implementing"
phase: "now"
summary: "List interaction specifications with stable IDs and document-owned acceptance criteria."
related_region: "cli.output"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# List specifications

## Intent

List interaction specifications with stable IDs and document-owned acceptance criteria.

## Trigger / Entry Points

The user runs `spectrum list [repository path]` (`pnpm spec:list` in this repository), or the Spectrum host skill runs the bundled CLI.

## Preconditions

A local repository and a schema_version 2 configuration identify canonical documents and inventory schemas. External service authentication is not required for local reads.

## Expected Outcome

The CLI prints the `specs` array of the same check as JSON. Each entry carries its interaction ID, feature ID, category key, title, document status, declared lifecycle, phase, path, acceptance criteria and resolved links.

## State Changes

Canonical repository files stay unchanged. The response contains a derived model for the current read.

## User-visible Feedback

Document status, declared lifecycle and phase appear as separate fields. Each acceptance criterion shows its ID, statement, checkbox state and a verification value that stays `not_recorded` without an evidence adapter.

## Edge Cases / Failure Handling

Malformed TSV, JSON schemas, YAML or TOML produce failures. Missing references and symlink escapes produce failures. TBD remains a visible unresolved warning. Missing data is never replaced with a successful sample. Structural errors still print the parsed specifications.

## Acceptance Criteria

- [ ] **AC-1:** List returns the same interaction specifications and stable IDs as check, sorted by interaction ID.
- [ ] **AC-2:** Each result identifies its feature, category, Markdown path and AC IDs.
- [ ] **AC-3:** Structural errors cause a nonzero exit status while the repository remains unchanged.

## Permissions / Dependencies

Read-only local inspection is executable. Human review annotations do not grant authority to apply, commit, push, merge or post externally.

## Observability / Analytics

Local JSON output and process exit status are available. Hosted telemetry remains unimplemented.

## Related Interactions

- [Check repository](../SP-001/SP-001-check_repository.md)
- [Browse specifications](../SP-002/SP-002-browse_specifications.md)
- [Run plugin checks](../SP-004/SP-004-run_plugin_checks.md)

## Source

- [Contract](../contracts/validation.toml)
- [Flow](../flows/validation.md)
