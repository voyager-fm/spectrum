---
interaction_id: "DSH-001-view_specification_document"
interaction_type: "display"
feature: "Specification browsing"
category_key: "DSH"
feature_id: "DSH-001"
status: "implementing"
phase: "now"
summary: "Read a contract, flow, page, engineering, rule or reference document in the reader with its links in both directions."
related_region: "web.spec_document"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# View specification document

## Intent

Read a contract, flow, page, engineering, rule or reference document in the reader with its links in both directions.

## Trigger / Entry Points

The user selects a document in the specification tree, the documents table, the reader rail, ⌘K search or a link inside another document, or opens `/specs/documents/<repository-relative path>` directly.

## Preconditions

The path is a document loaded by the shared model in the current check result.

## Expected Outcome

The page shows the document's kind, title and path, and its structural findings above the body. A Markdown document renders as text with its sections. A TOML, JSON, TSV or other document shows its source with line numbers and wrapped long lines. A rail lists the document's sections, its structural findings, the documents it links to, the documents that link to it and its path; for a connected repository the path opens GitHub at the checked SHA.

## State Changes

No repository or server state changes.

## User-visible Feedback

The document is marked in the specification tree, and its group starts expanded. Links to other loaded documents and interactions open in the reader; external links open in a new tab and are marked.

## Edge Cases / Failure Handling

A path that is not a loaded document returns the not-found page. Links that escape the repository or use another scheme are never linked. Raw HTML stays literal text and images render as links, so a repository file cannot inject markup. A link to a path that is not a loaded document is text locally and opens GitHub at the checked SHA for a connected repository.

## Acceptance Criteria

- [ ] **AC-1:** Every loaded non-interaction document opens at its repository-relative path; any other path returns not found.
- [ ] **AC-2:** Markdown renders as text only, and other formats show their source with line numbers.
- [ ] **AC-3:** The rail lists the documents linked in both directions, and each opens in the reader.
- [ ] **AC-4:** For a connected repository, links and the source location stay on the checked commit.

## Permissions / Dependencies

Read-only. The page offers no edit action.

## Observability / Analytics

Page load errors are shown in the page. Hosted telemetry remains unimplemented.

## Related Interactions

- [Browse specifications](DSH-001-browse_specifications.md)
- [View specification detail](DSH-001-view_specification_detail.md)
- [Search specifications](DSH-001-search_specifications.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Spec document page contract](../../../../website/page_contracts/spec_document/contract.toml)
