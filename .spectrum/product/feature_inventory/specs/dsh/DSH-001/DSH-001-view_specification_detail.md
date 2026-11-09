---
interaction_id: "DSH-001-view_specification_detail"
interaction_type: "display"
feature: "Specification browsing"
category_key: "DSH"
feature_id: "DSH-001"
status: "implementing"
phase: "now"
summary: "Read one interaction's rendered document with its separate states, acceptance criteria, findings, outline and links in both directions."
related_region: "web.spec_detail"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# View specification detail

## Intent

Read one interaction's rendered document with its separate states, acceptance criteria, findings, outline and links in both directions.

## Trigger / Entry Points

The user selects an interaction in the `/specs` table, the specification tree, ⌘K search, a link in another document or the previous and next links, or opens `/specs/<interaction id>` directly.

## Preconditions

The dashboard server can read the configured repository and the interaction ID exists in the inventory or as a specification document in the current check result.

## Expected Outcome

The page shows the category and feature, the interaction title and ID, and a property grid with separate values for declared lifecycle, phase, type, region, document status and the structural check for this file. Below it the specification document renders as text with its sections; the Acceptance Criteria section is replaced by an acceptance-criteria table. Links inside the document open other interactions and documents in the reader. A rail lists the document's sections, this file's findings, the documents it links to, the documents that link to it and its path. Previous and next links move between interactions with a document in inventory order. An interaction declared only in the inventory shows its declared fields and states that it has no document yet.

[next] Connected code is an additional section below Acceptance criteria governed by TRC-001. It shows explicit implementation locations and source context; the reader's links in both directions remain available.

## State Changes

No repository or server state changes.

## User-visible Feedback

Every acceptance criterion shows "Not recorded" verification until an evidence adapter supplies an execution record, and the table notes that checked boxes are not evidence. The declared lifecycle value states that the inventory value is not executed test evidence. Criteria without a stable ID show "Unassigned". The current interaction is marked in the tree.

## Edge Cases / Failure Handling

An unknown ID returns the not-found page. A link to a path that is not a loaded document is shown as text. Links that escape the repository or use another scheme are never linked. Raw HTML in the document stays literal text and images render as links, so a repository file cannot inject markup. When the repository check fails elsewhere, a spec without its own findings shows "Repository needs review" instead of "No findings".

## Acceptance Criteria

- [ ] **AC-1:** Document status, declared lifecycle with phase and structural findings appear as separate values.
- [ ] **AC-2:** Each acceptance criterion shows its stable ID, statement and a Not recorded verification state; checked boxes do not change it.
- [ ] **AC-3:** Only findings for this specification's path are counted on the page.
- [ ] **AC-4:** An unknown interaction ID returns the not-found page.
- [ ] **AC-5:** Linked documents open in the reader; a link to a path that is not a loaded document is shown as text instead of a broken link.
- [ ] **AC-7:** The document renders as text only: raw HTML stays literal, images are not loaded and links outside the repository or with another scheme are not followed.
- [ ] **AC-8:** The rail lists the document's sections and the documents linked in both directions.
- [ ] **AC-9:** An interaction declared only in the inventory shows its declared fields and an explicit no-document state.

- [ ] **AC-6:** [next] Connected code follows the implementation-link contract, keeps local working-tree and pinned remote contexts distinct, and never labels a file link as implementation or test evidence.

## Permissions / Dependencies

Read-only local inspection. The page offers no approval or edit action.

## Observability / Analytics

Page load errors are shown in the page. Hosted telemetry remains unimplemented.

## Related Interactions

- [Browse specifications](DSH-001-browse_specifications.md)
- [List specifications](../../val/VAL-001/VAL-001-list_specifications.md)
- [View specification document](DSH-001-view_specification_document.md)
- [Search specifications](DSH-001-search_specifications.md)

- [Inspect linked implementation](../../trc/TRC-001/TRC-001-inspect_linked_implementation.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Spec detail page contract](../../../../website/page_contracts/spec_detail/contract.toml)
- [Implementation-link contract](../../trc/contracts/implementation_links.toml)
