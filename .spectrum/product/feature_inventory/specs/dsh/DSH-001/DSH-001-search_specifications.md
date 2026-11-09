---
interaction_id: "DSH-001-search_specifications"
interaction_type: "input"
feature: "Specification browsing"
category_key: "DSH"
feature_id: "DSH-001"
status: "implementing"
phase: "now"
summary: "Jump to an interaction by ID, title, summary or acceptance criterion, to a category or feature by title or description, or to a document by title or path, from any reader page."
related_region: "web.spec_search"
menu: "-"
shortcut: "⌘K"
document_status: "draft"
---

# Search specifications

## Intent

Jump to an interaction by ID, title, summary or acceptance criterion, to a category or feature by title or description, or to a document by title or path, from any reader page.

## Trigger / Entry Points

The user presses ⌘K or Ctrl+K, presses `/` outside a text field, or selects "Search specs" at the top of the specification tree.

## Preconditions

A reader page (`/specs`, a spec detail or a spec document, locally or for a connected repository) has loaded the current check result.

## Expected Outcome

A dialog opens with a search field. Results list interactions, matched on ID, title, summary, feature, category and acceptance-criterion statements; categories and features, matched on key or ID, title and description; and documents, matched on title and path. Every word must match; ID and title matches rank first. Arrow keys move the selection and Enter opens the selected result in the reader.

## State Changes

No repository or server state changes. Opening a result navigates within the same repository and revision.

## User-visible Feedback

Each result shows its title, its ID or path and its kind. The keyboard shortcut is shown on the search button.

## Edge Cases / Failure Handling

When nothing matches, the dialog states that no spec or document matches the query. Interactions declared only in the inventory are found and open their no-document state.

## Acceptance Criteria

- [ ] **AC-1:** ⌘K, Ctrl+K and `/` outside a text field open the search from every reader page.
- [ ] **AC-2:** A query matches interaction IDs, titles, summaries and acceptance criteria, category and feature titles and descriptions, and document titles and paths.
- [ ] **AC-3:** The keyboard alone selects and opens a result.
- [ ] **AC-4:** Results open within the same repository and revision as the page they were opened from.

## Permissions / Dependencies

Read-only. Search runs in the browser on an index built from the loaded model.

## Observability / Analytics

None. Hosted telemetry remains unimplemented.

## Related Interactions

- [Browse specifications](DSH-001-browse_specifications.md)
- [Filter specifications](DSH-001-filter_specifications.md)
- [View specification detail](DSH-001-view_specification_detail.md)
- [View specification document](DSH-001-view_specification_document.md)
- [View feature category](DSH-001-view_feature_category.md)
- [View feature](DSH-001-view_feature.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Specs surface contract](../../../surfaces/web/specs/contract.toml)
