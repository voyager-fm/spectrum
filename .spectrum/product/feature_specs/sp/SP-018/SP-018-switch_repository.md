---
interaction_id: "SP-018-switch_repository"
interaction_type: "input"
feature: "Connected repositories"
category_key: "INT"
feature_id: "SP-018"
status: "implementing"
phase: "now"
summary: "Switch the dashboard between the local repository and connected GitHub repositories."
related_region: "web.repository"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Switch repository

## Intent

Move between the local repository and the connected repositories without retyping their addresses.

## Trigger / Entry Points

The user opens the repository switcher in the dashboard sidebar.

## Preconditions

The local repository is always listed. Connected repositories are listed when the GitHub App is configured.

## Expected Outcome

Selecting an entry opens that repository's dashboard view. The current repository is marked.

## State Changes

None beyond navigation.

## User-visible Feedback

The local repository and each connected repository by full name. When the App is not configured, an explicit unavailable state replaces the connected entries.

## Edge Cases / Failure Handling

Installation listing errors are shown in the switcher without hiding the local repository.

## Acceptance Criteria

- [ ] **AC-1:** The switcher lists the local repository and every repository the App installations can read.
- [ ] **AC-2:** Selecting an entry opens that repository's view and marks it current.
- [ ] **AC-3:** An unconfigured App or listing error leaves the local repository available and states why connected entries are missing.

## Permissions / Dependencies

Requires the GitHub App to list connected repositories. Read-only.

## Observability / Analytics

No switching history is recorded.

## Related Interactions

- [Browse remote specifications](SP-018-browse_remote_specifications.md)
- [View setup checklist](../SP-017/SP-017-view_setup_checklist.md)

## Source

- [Contract](../contracts/connections.toml)
- [Flow](../flows/connections.md)
- [GitHub connection](../../../../contracts/github-connection.md)
