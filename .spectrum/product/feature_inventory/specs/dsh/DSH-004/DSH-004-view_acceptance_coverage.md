---
interaction_id: "DSH-004-view_acceptance_coverage"
interaction_type: "display"
feature: "Specification health"
category_key: "DSH"
feature_id: "DSH-004"
status: "implementing"
phase: "now"
summary: "Count acceptance criteria, criteria without stable IDs and specifications without criteria, keeping checkboxes as author annotations."
related_region: "web.overview"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# View acceptance coverage

## Intent

Show how completely the specifications state their acceptance criteria, so authors can find specifications that cannot be verified yet.

## Trigger / Entry Points

The Acceptance criteria section of the local Overview and of a connected repository's overview.

## Preconditions

The shared engine has read the repository's specifications.

## Expected Outcome

Summary figures show the total number of acceptance criteria, how many carry a stable `AC-` ID and the share as a meter, how many specifications have no criteria, and how many checkboxes authors have ticked. Specifications without criteria and those with criteria lacking stable IDs are listed and link to their detail pages.

## State Changes

None.

## User-visible Feedback

The ticked count is labeled as author annotation, not execution evidence. Execution evidence stays "Not recorded".

## Edge Cases / Failure Handling

Without specifications the section shows an empty notice. When every specification has criteria with stable IDs, the lists are replaced by a sentence that says so.

## Acceptance Criteria

- [ ] **AC-1:** The total equals the sum of each specification's acceptance criteria.
- [ ] **AC-2:** A criterion without a stable ID is counted and its specification is listed.
- [ ] **AC-3:** Ticked checkboxes are never labeled as passed, verified or tested.

## Permissions / Dependencies

Read-only. Uses the shared engine result already loaded for the page.

## Observability / Analytics

None.

## Related Interactions

- [View status distribution](DSH-004-view_status_distribution.md)
- [View specification detail](../DSH-001/DSH-001-view_specification_detail.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
