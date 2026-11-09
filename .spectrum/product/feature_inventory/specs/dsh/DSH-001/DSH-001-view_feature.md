---
interaction_id: "DSH-001-view_feature"
interaction_type: "display"
feature: "Specification browsing"
category_key: "DSH"
feature_id: "DSH-001"
status: "implementing"
phase: "now"
summary: "Read one feature's description, category, related UI and interactions."
related_region: "web.spec_feature"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# View feature

## Intent

Read one feature's description, category, related UI and interactions.

## Trigger / Entry Points

The user selects a feature in the specification tree, the categories and features table or a category page, follows the feature link in a spec breadcrumb, picks a feature in ⌘K search, or opens `/specs/features/<feature id>` directly.

## Preconditions

The feature ID is declared in the feature inventory or referenced by an interaction in the current check result.

## Expected Outcome

The page shows a breadcrumb to the feature's category, the feature title, ID and description from the inventory, and a property grid with its interaction count, interactions with a document, the lifecycle mix and the related UI region. Below it the filterable interaction table lists the feature's interactions, and links lead to the previous and next feature in inventory order.

## State Changes

No repository or server state changes.

## User-visible Feedback

The feature is marked in the specification tree and its category is expanded. The lifecycle mix is labeled as declared in the inventory and not executed evidence.

## Edge Cases / Failure Handling

An unknown feature ID returns the not-found page. A feature without a description says the inventory gives none. A feature with no interactions says so instead of showing an empty table. A feature that interactions reference without a declaration is labeled "Not declared in the inventory".

## Acceptance Criteria

- [ ] **AC-1:** The page shows the feature's inventory description, category and related UI region.
- [ ] **AC-2:** The interaction table lists exactly the interactions whose feature ID matches, including those without a document.
- [ ] **AC-3:** An unknown feature ID returns the not-found page.
- [ ] **AC-4:** For a connected repository, the page and its links stay on the pinned commit and keep the selected ref or pull request.

## Permissions / Dependencies

Read-only. The page offers no edit action.

## Observability / Analytics

Page load errors are shown in the page. Hosted telemetry remains unimplemented.

## Related Interactions

- [Browse specifications](DSH-001-browse_specifications.md)
- [View feature category](DSH-001-view_feature_category.md)
- [View specification detail](DSH-001-view_specification_detail.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Spec feature surface](../../../surfaces/web/spec_feature/contract.toml)
