---
interaction_id: "INT-004-browse_remote_specifications"
interaction_type: "display"
feature: "Connected repositories"
category_key: "INT"
feature_id: "INT-004"
status: "planned"
phase: "now"
summary: "List a connected repository's interaction specifications at one pinned commit."
related_region: "web.repository"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Browse remote specifications

## Intent

Read a hosted repository's specifications the same way as the local ones, without cloning it.

## Trigger / Entry Points

The user opens `/repositories/{owner}/{repo}/specs`, optionally with `?ref=` or `?pr=`, which links preserve.

## Preconditions

The GitHub App is configured and installed on the repository, and the requested revision resolves to a commit.

## Expected Outcome

The page lists the interaction specifications the shared engine reads from that commit's snapshot, with their stable IDs, FI states and finding counts, and names the commit.

## State Changes

No repository writes. Results are cached per commit SHA, and with accounts enabled one check record per SHA is stored in the service database. The snapshot is removed after reading.

## User-visible Feedback

The commit SHA and ref the list belongs to, and an explicit empty state when the commit has no configuration.

## Edge Cases / Failure Handling

A missing or invalid configuration shows the setup checklist instead of an empty list. Download or extraction errors are shown without sample data. A cached result is never shown for a different SHA.

## Acceptance Criteria

- [ ] **AC-1:** The list shows the specs the shared engine reads at the pinned commit and names that SHA.
- [ ] **AC-2:** Navigation keeps the selected ref or pull request.
- [ ] **AC-3:** A cached result is used only for the same commit SHA.

## Permissions / Dependencies

Requires the GitHub App with read access. Nothing is written to the repository.

## Observability / Analytics

Each result is bound to its commit SHA. With accounts enabled, the analysis is stored once per commit SHA as check history; in single-operator mode nothing is stored.

## Related Interactions

- [View remote specification](INT-004-view_remote_specification.md)
- [Browse specifications](../../dsh/DSH-001/DSH-001-browse_specifications.md)
- [View setup checklist](../../set/SET-004/SET-004-view_setup_checklist.md)

## Source

- [Contract](../contracts/connections.toml)
- [Flow](../flows/connections.md)
- [GitHub connection](../../../../../contracts/github-connection.md)
