# Spec detail layout

## Regions

Repository navigation, page heading and load errors precede the page content. Tables and document previews use the existing dashboard components.

## Planned Connected code region

[next] Place Connected code immediately after Acceptance criteria in the shared local and remote detail. Each row shows its authored label, relative path, optional line range and resolution state. The section identifies the repository and checked SHA or labels Working tree. Not linked and failed reads are distinct. Local Copy location and remote View on GitHub actions follow the implementation-link contract; there is no code preview or dashboard link editor in this slice.

## Sources

- [Page contract](contract.toml)
- [Flow](flow.md)
- [Implementation-link contract](../../../feature_inventory/specs/trc/contracts/implementation_links.toml)
