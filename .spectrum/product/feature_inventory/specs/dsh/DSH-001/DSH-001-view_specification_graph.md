---
interaction_id: "DSH-001-view_specification_graph"
interaction_type: "display"
feature: "Specification browsing"
category_key: "DSH"
feature_id: "DSH-001"
status: "implementing"
phase: "now"
summary: "See every interaction, feature, category and document of a connected repository as a force-directed graph of the links, ownership, regions and membership the specs declare."
related_region: "web.spec_graph"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# View specification graph

## Intent

See every interaction, feature, category and document of a connected repository as a force-directed graph of the links, ownership, regions and membership the specs declare, so clusters, hubs and unconnected specs stand out.

## Trigger / Entry Points

The user selects **Graph view** beside the revision line on a connected repository's Specs page, or opens `/repositories/<owner>/<repo>/specs/graph` directly. The revision query (`ref` or `pr`) carries over.

## Preconditions

The connected repository is readable and its pinned commit has a readable `.spectrum/config.json`.

## Expected Outcome

The graph shows one node per interaction, feature, category and loaded non-interaction document at the pinned commit. An interaction's spec document is the interaction node itself. Edges are undirected and come only from the shared model and the inventory: a link written in a document, a contract that owns an interaction, a surface contract that covers an interaction's region, and membership of an interaction in its feature and of a feature in its category. Links to paths that are not loaded documents are left out.

Interactions are solid ink, other documents muted ink, features and categories hollow rings, and an interaction without a spec document has a dashed ring. A node with structural errors has a destructive ring. Membership edges are dashed. The brand accent marks only the selected or hovered node, its edges and highlighted search matches.

The layout settles from a deterministic start and fits the view until the user pans, zooms or drags. Scrolling zooms around the pointer, dragging the background pans and dragging a node moves it. Hovering or selecting a node dims everything outside its neighbourhood and labels it; zooming in labels every node. Group toggles hide and show interactions, features, categories and each document kind. The highlight field marks matching IDs, titles and paths, and Enter selects and centres the first match.

A side panel shows the selected node's kind, title, ID, path and error count, an **Open** action and every connected node; choosing a connected node selects and centres it. Double-clicking a node opens its reader page.

## State Changes

No repository or server state changes. Group toggles, the highlight query, the selection and the view stay in the page and reset on reload.

## User-visible Feedback

The match count updates as the highlight query changes. Hidden groups are struck through. With every group hidden the canvas says so.

## Edge Cases / Failure Handling

A commit that declares no interactions or documents shows an empty notice instead of a canvas. A repository that cannot be read shows the same states as the Specs page (sign-in, not installed, misconfigured, load errors). The graph never infers edges from text similarity and never shows sample nodes. Declared lifecycle and document status are not drawn as evidence of implementation.

## Acceptance Criteria

- [ ] **AC-1:** Every interaction, feature, category and loaded non-interaction document at the pinned commit is exactly one node, and an interaction with a spec document shares that document's node.
- [ ] **AC-2:** Edges come only from document links, contract ownership, region contracts and inventory membership; duplicates collapse to one edge and unresolved links are left out.
- [ ] **AC-3:** Selecting a node lists its connected nodes, and Open or a double-click opens its reader page at the same revision.
- [ ] **AC-4:** Group toggles hide nodes and their edges, and the highlight field selects and centres the first match on Enter.
- [ ] **AC-5:** The canvas follows the light or dark theme and the page has no horizontal scroll at 390px.

## Permissions / Dependencies

Read-only. Uses the same GitHub App installation access as the connected repository's Specs page.

## Observability / Analytics

Page load errors are shown in the page. Hosted telemetry remains unimplemented.

## Related Interactions

- [Browse specifications](DSH-001-browse_specifications.md)
- [View specification document](DSH-001-view_specification_document.md)
- [Search specifications](DSH-001-search_specifications.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Spec graph surface contract](../../../surfaces/web/spec_graph/contract.toml)
