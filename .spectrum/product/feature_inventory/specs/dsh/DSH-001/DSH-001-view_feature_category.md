---
interaction_id: "DSH-001-view_feature_category"
interaction_type: "display"
feature: "Specification browsing"
category_key: "DSH"
feature_id: "DSH-001"
status: "implementing"
phase: "now"
summary: "Read one feature category's description, its features and every interaction under it."
related_region: "web.spec_category"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# View feature category

## Intent

Read one feature category's description, its features and every interaction under it.

## Trigger / Entry Points

The user selects a category name in the specification tree or the categories and features table, follows the category link in a spec or feature breadcrumb, picks a category in ⌘K search, or opens `/specs/categories/<category key>` directly.

## Preconditions

The category key is declared in the feature category inventory or referenced by an interaction in the current check result.

## Expected Outcome

The page shows the category title, key and description from the inventory; counts for its features, interactions, interactions with a document and interactions declared implementing; a features table with each feature's description, interaction count, lifecycle mix and related UI region; the filterable interaction table limited to the category; and links to the previous and next category in inventory order.

## State Changes

No repository or server state changes.

## User-visible Feedback

The category is marked and expanded in the specification tree. Lifecycle counts use the same solid, ringed and dashed markers as the interaction table.

## Edge Cases / Failure Handling

An unknown category key returns the not-found page. A category without a description says the inventory gives none. A category with no features or interactions says so instead of showing an empty table. A category that interactions reference without a declaration is labeled "Not declared in the inventory".

## Acceptance Criteria

- [ ] **AC-1:** The page shows the category's inventory description and lists every feature declared for it, including features without interactions.
- [ ] **AC-2:** The interaction table lists exactly the interactions whose category key matches, including those without a document.
- [ ] **AC-3:** An unknown category key returns the not-found page.
- [ ] **AC-4:** For a connected repository, the page and its links stay on the pinned commit and keep the selected ref or pull request.

## Permissions / Dependencies

Read-only. The page offers no edit action.

## Observability / Analytics

Page load errors are shown in the page. Hosted telemetry remains unimplemented.

## Related Interactions

- [Browse specifications](DSH-001-browse_specifications.md)
- [View feature](DSH-001-view_feature.md)
- [Search specifications](DSH-001-search_specifications.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Spec category surface](../../../surfaces/web/spec_category/contract.toml)
