---
interaction_id: "SP-018-view_remote_specification"
interaction_type: "display"
feature: "Connected repositories"
category_key: "INT"
feature_id: "SP-018"
status: "implementing"
phase: "now"
summary: "Read one interaction of a connected repository at one pinned commit with its criteria, findings and source link."
related_region: "web.repository"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# View remote specification

## Intent

Inspect one hosted interaction in detail at a known commit, and open its source on GitHub.

## Trigger / Entry Points

The user selects a specification from the remote list, or opens its URL with the same ref or pull request query.

## Preconditions

The GitHub App is configured and installed on the repository, and the requested revision resolves to a commit. The interaction ID exists at that commit.

## Expected Outcome

The page shows the interaction's FI states, acceptance criteria with verification state, linked documents, its own findings and a GitHub link to the file at the pinned SHA.

## State Changes

None.

## User-visible Feedback

The commit SHA, declared states kept separate from executed evidence, and findings scoped to the interaction.

## Edge Cases / Failure Handling

An unknown interaction ID shows a not-found state for that commit. Checked boxes are not shown as verified evidence.

## Acceptance Criteria

- [ ] **AC-1:** The detail shows the interaction's states, criteria, findings and links at the pinned commit.
- [ ] **AC-2:** The source link opens the file at that exact SHA on GitHub.
- [ ] **AC-3:** An interaction missing at the commit shows a not-found state instead of another revision's data.

## Permissions / Dependencies

Requires the GitHub App with read access. Nothing is written to the repository.

## Observability / Analytics

Bound to the commit SHA shown on the page.

## Related Interactions

- [Browse remote specifications](SP-018-browse_remote_specifications.md)
- [View specification detail](../SP-002/SP-002-view_specification_detail.md)

## Source

- [Contract](../contracts/connections.toml)
- [Flow](../flows/connections.md)
- [GitHub connection](../../../../contracts/github-connection.md)
