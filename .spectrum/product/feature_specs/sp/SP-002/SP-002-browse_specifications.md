---
interaction_id: "SP-002-browse_specifications"
interaction_type: "display"
feature: "Specification browsing"
category_key: "DSH"
feature_id: "SP-002"
status: "implementing"
phase: "now"
summary: "Inspect specification relationships and distinguish declared status from executed evidence."
related_region: "web.specs"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Browse specifications

## Intent

Inspect specification relationships and distinguish declared status from executed evidence.

## Trigger / Entry Points

The user opens `/specs` from the dashboard navigation.

## Preconditions

A local repository and a schema_version 2 configuration identify canonical documents and inventory schemas. External service authentication is not required for local reads.

## Expected Outcome

A table lists every interaction specification with its ID, title, document status, acceptance-criteria count and link count. Each ID opens its detail page. Shared contracts and flows appear below the table with their paths.

## State Changes

Canonical repository files stay unchanged. The response contains a derived model for the current read.

## User-visible Feedback

Document status is labeled as a review annotation. IDs and paths use monospace text.

## Edge Cases / Failure Handling

Malformed TSV, JSON schemas, YAML or TOML produce failures. Missing references and symlink escapes produce failures. TBD remains a visible unresolved warning. Missing data is never replaced with a successful sample. With no specifications, an empty notice points to `pnpm spec:check`.

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

Page load errors are shown in the page. Hosted telemetry remains unimplemented.

## Related Interactions

- [List specifications](../SP-001/SP-001-list_specifications.md)
- [View repository overview](../SP-002/SP-002-view_repository_overview.md)
- [View specification detail](../SP-002/SP-002-view_specification_detail.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Specs page contract](../../../../website/page_contracts/specs/contract.toml)
