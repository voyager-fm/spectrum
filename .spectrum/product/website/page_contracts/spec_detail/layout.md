# Spec detail layout

## Regions

Repository navigation, page heading and load errors precede the reader. The specification tree, the rendered document and a rail with the outline, structural findings, links in both directions and the source location sit side by side on wide screens. Under 1280px the rail follows the document; under 1024px the tree collapses behind a toggle. A property grid separates lifecycle, phase, type, region, document status and the structural check. Acceptance criteria render as a table in place of the document's section. Previous and next links close the page.

## Planned Connected code region

[next] Place Connected code immediately after Acceptance criteria in the shared local and remote detail. Each row shows its authored label, relative path, optional line range and resolution state. The section identifies the repository and checked SHA or labels Working tree. Not linked and failed reads are distinct. Local Copy location and remote View on GitHub actions follow the implementation-link contract; there is no code preview or dashboard link editor in this slice.

## Sources

- [Page contract](contract.toml)
- [Flow](flow.md)
- [Implementation-link contract](../../../feature_inventory/specs/trc/contracts/implementation_links.toml)
