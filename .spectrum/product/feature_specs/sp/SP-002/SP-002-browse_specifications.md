---
interaction_id: "SP-002-browse_specifications"
interaction_type: "display"
feature: "Repository dashboard"
category_key: "SP"
feature_id: "SP-002"
status: "implementing"
phase: "now"
summary: "Inspect specification relationships and distinguish declared status from executed evidence."
related_region: "web.repository"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Browse specifications

## Intent

Inspect specification relationships and distinguish declared status from executed evidence.

## Trigger / Entry Points

The user opens the repository overview, specification list or specification detail route.

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

- [ ] **AC-1:** Dashboard lists the same specs as the CLI.
- [ ] **AC-2:** Statuses are document approval states, not implementation verification.
- [ ] **AC-3:** Dashboard is loopback-only and read-only in this scaffold.
- [ ] **AC-4:** The dashboard consumes the shared repository model instead of independently parsing feature JSON.
- [ ] **AC-5:** Interaction lifecycle, document review state, phase and recorded test evidence remain separate.
- [ ] **AC-6:** Configured web routes resolve to page contract, layout and flow documents.

## Permissions / Dependencies

Read-only local inspection is executable. Human review annotations do not grant authority to apply, commit, push, merge or post externally.

## Observability / Analytics

Local JSON findings and process exit status are available. Hosted telemetry, model jobs and PR review publication remain unimplemented.

## Related Interactions

- [Check repository](../SP-001/SP-001-check_repository.md)
- [List specifications](../SP-001/SP-001-list_specifications.md)
- [Review proposal](../SP-003/SP-003-review_proposal.md)
- [Run plugin checks](../SP-004/SP-004-run_plugin_checks.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
