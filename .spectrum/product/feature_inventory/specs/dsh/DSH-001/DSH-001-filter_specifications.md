---
interaction_id: "DSH-001-filter_specifications"
interaction_type: "input"
feature: "Specification browsing"
category_key: "DSH"
feature_id: "DSH-001"
status: "implementing"
phase: "now"
summary: "Narrow the interaction table by text, category, lifecycle, phase, type, document presence and findings, kept in the URL."
related_region: "web.specs"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Filter specifications

## Intent

Narrow the interaction table by text, category, lifecycle, phase, type, document presence and findings, kept in the URL.

## Trigger / Entry Points

The user types in the "Filter by text" field or picks values from the Category, Lifecycle, Phase, Type and More menus above the interaction table in `/specs`, or opens `/specs` with filter parameters.

## Preconditions

The specs page has loaded the current check result.

## Expected Outcome

The table shows only the interactions that match every active filter. Text matches the ID, title, summary and feature title; every word must match. Values within one facet are alternatives. The More menu limits rows to interactions with or without a document and to interactions with structural findings. Each facet value shows how many interactions carry it. Active filters appear as removable chips with a "Clear all" action, and a count shows how many of all interactions are listed.

## State Changes

The filter is written to the URL query (`q`, `category`, `lifecycle`, `phase`, `type`, `document`, `findings`) without adding history entries; other query parameters such as `ref` and `pr` are kept. No repository or server state changes.

## User-visible Feedback

The "N of M" count updates with every change. Facet buttons show how many values are selected.

## Edge Cases / Failure Handling

When nothing matches, the table states "No interaction matches these filters." and offers "Clear filters". Unknown values in the URL match nothing rather than being dropped silently. Category headers appear only for categories that still have rows.

## Acceptance Criteria

- [ ] **AC-1:** Text, category, lifecycle, phase, type, document presence and findings filters combine, and the count shows matching and total interactions.
- [ ] **AC-2:** The filter is restored from the URL on reload and keeps the selected ref or pull request.
- [ ] **AC-3:** An empty result states that no interaction matches and offers to clear the filters.
- [ ] **AC-4:** Filtering never changes the declared lifecycle, document status or findings it filters on.

## Permissions / Dependencies

Read-only. Filtering runs in the browser on the already loaded model.

## Observability / Analytics

None. Hosted telemetry remains unimplemented.

## Related Interactions

- [Browse specifications](DSH-001-browse_specifications.md)
- [Search specifications](DSH-001-search_specifications.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Specs surface contract](../../../surfaces/web/specs/contract.toml)
