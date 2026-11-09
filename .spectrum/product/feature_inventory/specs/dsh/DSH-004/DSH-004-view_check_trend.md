---
interaction_id: "DSH-004-view_check_trend"
interaction_type: "display"
feature: "Specification health"
category_key: "DSH"
feature_id: "DSH-004"
status: "implementing"
phase: "now"
summary: "Chart finding and specification counts across a connected repository's stored checks."
related_region: "web.overview"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# View check trend

## Intent

Show whether a connected repository's specification health improves or regresses across the commits Spectrum has checked.

## Trigger / Entry Points

The Check trend section of a connected repository's overview at `/repositories/{owner}/{repo}`.

## Preconditions

The dashboard runs with accounts, so checks are stored per commit. At least one check of the repository is stored.

## Expected Outcome

One chart shows the errors and warnings of each stored check as stacked columns, oldest to newest. A second chart shows the number of specifications read at each check. Each column names its short SHA and check time on hover and focus, and links to that commit's overview. The commit shown on the page is marked. The existing check history table is the table view of the same data.

## State Changes

None. History is written by checks, not by this view.

## User-visible Feedback

The section says that each point is one deterministic structural check of one commit, ordered by check time, not by commit order.

## Edge Cases / Failure Handling

Without stored history (single-operator mode or the local Overview) the section explains that history is stored only when accounts are enabled and shows no chart. With one stored check the section shows that check and says a trend needs two. Charts never show sample data.

## Acceptance Criteria

- [ ] **AC-1:** Each column's errors and warnings equal the stored check's counts.
- [ ] **AC-2:** Without stored history no chart or sample data is shown.
- [ ] **AC-3:** Finding counts and specification counts use separate charts with one axis each.

## Permissions / Dependencies

Reads the stored check history of the connected repository, which the viewer must be able to access.

## Observability / Analytics

None.

## Related Interactions

- [Browse remote specifications](../../int/INT-004/INT-004-browse_remote_specifications.md)
- [View repository overview](../DSH-001/DSH-001-view_repository_overview.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [GitHub connection](../../../../../contracts/github-connection.md)
