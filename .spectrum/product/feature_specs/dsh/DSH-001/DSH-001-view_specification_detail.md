---
interaction_id: "DSH-001-view_specification_detail"
interaction_type: "display"
feature: "Specification browsing"
category_key: "DSH"
feature_id: "DSH-001"
status: "implementing"
phase: "now"
summary: "Read one interaction with its separate states, acceptance criteria, findings and linked documents."
related_region: "web.spec_detail"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# View specification detail

## Intent

Read one interaction with its separate states, acceptance criteria, findings and linked documents.

## Trigger / Entry Points

The user selects an interaction ID in `/specs` or opens `/specs/<interaction id>` directly.

## Preconditions

The dashboard server can read the configured repository and the interaction ID exists in the current check result.

## Expected Outcome

The page shows the interaction title, ID and path; separate cards for document status, declared lifecycle with phase, and structural check findings for this file; an acceptance-criteria table; and each linked document as an expandable preview.

[next] Connected code is an additional section below Acceptance criteria governed by TRC-001. It shows explicit implementation locations and source context; existing linked-document previews remain available.

## State Changes

No repository or server state changes.

## User-visible Feedback

Every acceptance criterion shows "Not recorded" verification until an evidence adapter supplies an execution record. The declared lifecycle card states that the inventory value is not executed test evidence. Criteria without a stable ID show "Unassigned".

## Edge Cases / Failure Handling

An unknown ID returns the not-found page. A linked path without a loaded document shows "Preview unavailable for this path". When the repository check fails elsewhere, a spec without its own findings shows "Repository needs review" instead of "No findings".

## Acceptance Criteria

- [ ] **AC-1:** Document status, declared lifecycle with phase and structural findings appear as separate values.
- [ ] **AC-2:** Each acceptance criterion shows its stable ID, statement and a Not recorded verification state; checked boxes do not change it.
- [ ] **AC-3:** Only findings for this specification's path are counted on the page.
- [ ] **AC-4:** An unknown interaction ID returns the not-found page.
- [ ] **AC-5:** Linked documents preview the loaded canonical content or state that no preview is available.

- [ ] **AC-6:** [next] Connected code follows the implementation-link contract, keeps local working-tree and pinned remote contexts distinct, and never labels a file link as implementation or test evidence.

## Permissions / Dependencies

Read-only local inspection. The page offers no approval or edit action.

## Observability / Analytics

Page load errors are shown in the page. Hosted telemetry remains unimplemented.

## Related Interactions

- [Browse specifications](DSH-001-browse_specifications.md)
- [List specifications](../../val/VAL-001/VAL-001-list_specifications.md)

- [Inspect linked implementation](../../trc/TRC-001/TRC-001-inspect_linked_implementation.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Spec detail page contract](../../../website/page_contracts/spec_detail/contract.toml)
- [Implementation-link contract](../../trc/contracts/implementation_links.toml)
