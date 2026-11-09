---
interaction_id: "DSH-001-browse_specifications"
interaction_type: "display"
feature: "Specification browsing"
category_key: "DSH"
feature_id: "DSH-001"
status: "implementing"
phase: "now"
summary: "Browse every inventory interaction and canonical document in a tree and tables, keeping declared status apart from executed evidence."
related_region: "web.specs"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Browse specifications

## Intent

Browse every inventory interaction and canonical document in a tree and tables, keeping declared status apart from executed evidence.

## Trigger / Entry Points

The user opens `/specs` from the dashboard navigation or the "All interactions" link in the specification tree.

## Preconditions

A local repository and a schema_version 2 configuration identify canonical documents and inventory schemas. External service authentication is not required for local reads.

## Expected Outcome

The page opens the specification reader. A tree beside the content groups interactions by category and feature and lists documents under Overview, Flows, Contracts, Pages, Engineering, Rules and Reference. The content shows counts for categories, features, interactions, interactions with a document, interactions declared implementing and interactions with findings. Category and feature names in the tree open their pages. A table lists every inventory interaction grouped by category with its title, ID, feature, declared lifecycle, phase, type, acceptance-criteria count and structural findings; the table can be filtered (see [Filter specifications](DSH-001-filter_specifications.md)). Each title with a document opens its detail page. A categories and features table lists every declared feature under its category with the category's and feature's descriptions, the feature's interaction count, its lifecycle mix and its related UI region; category and feature names open their pages (see [View feature category](DSH-001-view_feature_category.md) and [View feature](DSH-001-view_feature.md)). A documents table lists contracts, flows, pages, engineering, rule, reference and overview documents one kind at a time with their paths and how many documents link to each; each title opens the document in the reader.

## State Changes

Canonical repository files stay unchanged. The response contains a derived model for the current read.

## User-visible Feedback

Document status is labeled as a review annotation. IDs and paths use monospace text. Lifecycle uses a solid, ringed or dashed marker for implementing, planned and idea. Interactions declared only in the inventory are listed without a link and marked in the tree. A legend states that lifecycle is declared in the inventory and is not executed evidence.

## Edge Cases / Failure Handling

Malformed TSV, JSON schemas, YAML or TOML produce failures. Missing references and symlink escapes produce failures. TBD remains a visible unresolved warning. Missing data is never replaced with a successful sample. With no specifications, an empty notice points to `pnpm spec:check`.

## Acceptance Criteria

- [ ] **AC-1:** Dashboard lists the same specs as the CLI.
- [ ] **AC-2:** Statuses are document approval states, not implementation verification.
- [ ] **AC-3:** Dashboard is loopback-only and read-only in this scaffold.
- [ ] **AC-4:** The dashboard consumes the shared repository model instead of independently parsing feature JSON.
- [ ] **AC-5:** Interaction lifecycle, document review state, phase and recorded test evidence remain separate.
- [ ] **AC-6:** Configured web routes resolve through their region to surface contract, layout and flow documents.
- [ ] **AC-7:** The table lists every inventory interaction, including those without a document, in category order, and only interactions with a document link to a detail page.
- [ ] **AC-8:** The tree and the documents table open every loaded canonical document in the reader.
- [ ] **AC-9:** Every declared category and feature is listed with its inventory description, including those without interactions.

## Permissions / Dependencies

Read-only local inspection is executable. Human review annotations do not grant authority to apply, commit, push, merge or post externally.

## Observability / Analytics

Page load errors are shown in the page. Hosted telemetry remains unimplemented.

## Related Interactions

- [List specifications](../../val/VAL-001/VAL-001-list_specifications.md)
- [View repository overview](DSH-001-view_repository_overview.md)
- [View specification detail](DSH-001-view_specification_detail.md)
- [Filter specifications](DSH-001-filter_specifications.md)
- [Search specifications](DSH-001-search_specifications.md)
- [View specification document](DSH-001-view_specification_document.md)
- [View feature category](DSH-001-view_feature_category.md)
- [View feature](DSH-001-view_feature.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Specs surface contract](../../../surfaces/web/specs/contract.toml)
