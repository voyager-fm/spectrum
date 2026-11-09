# Implementation source flow

## Contract References

- [Contract](../contracts/implementation_links.toml)

## Interaction Coverage

- [Resolve implementation links](../TRC-001/TRC-001-resolve_implementation_links.md)
- [Inspect linked implementation](../TRC-001/TRC-001-inspect_linked_implementation.md)
- [Open implementation source](../TRC-001/TRC-001-open_implementation_source.md)

## Happy Path

1. An author adds normal Markdown links beneath `### Implementation` within an interaction's `## Source`. Existing contract and flow references retain their owners. This optional declaration is authored in the repository, not through a new dashboard editor.
2. [next] The shared engine retains each label, declaring spec, repository-relative path, optional line fragment and source context. It resolves only explicit implementation declarations.
3. [next] The resolver checks the file inside the selected canonical root, refuses escaping symlinks and verifies a declared line range against the same observed file. It emits a resolution result without executing code or inferring behavioral correctness.
4. [next] The shared specification detail places a Connected code section after Acceptance criteria. The local page and connected-repository detail use the same result representation.
5. [next] A local user copies the relative location. A remote user opens GitHub at the checked commit SHA, even when the branch later moves. Neither action writes repository content.

## Failure Handling

- With no declaration, show Not linked; structural spec validation still works.
- Missing files, invalid ranges, blocked paths and unavailable reads remain distinct. Preserve the authored location and show a safe reason; do not expose temporary snapshot roots or private host paths.
- Do not silently remove malformed declarations, select another repository, switch to the default branch, or drop an invalid fragment to make the link look resolved.
- A failed check supplies no successful observation. A local working tree is labeled as such, including when Git metadata is absent or files are dirty.
- [next] Revalidate a target when resolving a new source context. An old resolution cannot be presented as current after the user switches repository or revision.

## Execution boundary

The three interactions are planned. The current parser reads Markdown destinations but the derived model does not preserve implementation roles or line ranges, and the dashboard does not implement this section. These specs establish a target, not an executed receipt.
