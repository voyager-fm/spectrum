---
interaction_id: "INT-004-view_remote_specification"
interaction_type: "display"
feature: "Connected repositories"
category_key: "INT"
feature_id: "INT-004"
status: "planned"
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

The page renders the interaction in the same reader as a local spec detail: its FI states, its document with acceptance criteria and verification state, its own findings, links in both directions and a GitHub link to the file at the pinned SHA. Links to loaded documents open in the reader at the same commit; links to other repository files open GitHub at that SHA.

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
- [ ] **AC-4:** Links in the document stay on the pinned commit, in the reader for loaded documents and on GitHub at that SHA for other files.

## Permissions / Dependencies

Requires the GitHub App with read access. Nothing is written to the repository.

## Observability / Analytics

Bound to the commit SHA shown on the page.

## Related Interactions

- [Browse remote specifications](INT-004-browse_remote_specifications.md)
- [View specification detail](../../dsh/DSH-001/DSH-001-view_specification_detail.md)

## Source

- [Contract](../contracts/connections.toml)
- [Flow](../flows/connections.md)
- [GitHub connection](../../../../../contracts/github-connection.md)
