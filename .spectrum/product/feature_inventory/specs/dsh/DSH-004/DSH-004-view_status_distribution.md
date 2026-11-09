---
interaction_id: "DSH-004-view_status_distribution"
interaction_type: "display"
feature: "Specification health"
category_key: "DSH"
feature_id: "DSH-004"
status: "implementing"
phase: "now"
summary: "Chart how specifications split by document review status, declared lifecycle and phase, overall and per category."
related_region: "web.overview"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# View status distribution

## Intent

Show where a repository's interaction specifications stand without merging document review, declared lifecycle and planning phase into one status.

## Trigger / Entry Points

The Spec health section of the local Overview at `/` and of a connected repository's overview at `/repositories/{owner}/{repo}`, at the selected revision.

## Preconditions

The shared engine has read the repository's specifications. Connected repositories also need a check result for the selected commit.

## Expected Outcome

Three segmented bars split all specifications by document review status, declared lifecycle status and phase. Each bar has a legend that lists every value with its count and share. A table lists each category key with its specification count, a lifecycle bar, its acceptance criteria count and its finding count. Values the repository uses outside the known vocabulary appear under their own names after the known values.

## State Changes

None.

## User-visible Feedback

The section says that document status and lifecycle are declared in the documents and are not implementation or test evidence. Hovering or focusing a segment shows its value, count and share.

## Edge Cases / Failure Handling

Without specifications the section shows an empty notice that names the configuration. When the check could not run, the section is omitted and the load error explains why. A value with zero specifications draws no segment.

## Acceptance Criteria

- [ ] **AC-1:** The three distributions count every specification once and their counts add up to the specification total.
- [ ] **AC-2:** Document review status, lifecycle and phase are shown as separate distributions, never combined.
- [ ] **AC-3:** Every segment's value and count is readable as text without hovering.
- [ ] **AC-4:** The category table counts specifications, acceptance criteria and findings per category key.

## Permissions / Dependencies

Read-only. Uses the shared engine result already loaded for the page.

## Observability / Analytics

None.

## Related Interactions

- [View repository overview](../DSH-001/DSH-001-view_repository_overview.md)
- [View acceptance coverage](DSH-004-view_acceptance_coverage.md)
- [Browse specifications](../DSH-001/DSH-001-browse_specifications.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Overview page contract](../../../../website/page_contracts/overview/contract.toml)
