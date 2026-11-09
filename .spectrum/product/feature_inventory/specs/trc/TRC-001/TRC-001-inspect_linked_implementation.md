---
interaction_id: "TRC-001-inspect_linked_implementation"
interaction_type: "display"
feature: "Specification implementation links"
category_key: "TRC"
feature_id: "TRC-001"
status: "planned"
phase: "next"
summary: "Show implementation paths, optional line ranges, resolution states and source context in the specification detail."
related_region: "web.spec_implementation"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Inspect linked implementation

## Intent

Show implementation paths, optional line ranges, resolution states and source context in the specification detail.

## Trigger / Entry Points

[next] The user opens a local or connected-repository interaction detail page.

## Preconditions

The interaction exists in a check result and its source context is known. A failed or missing resolver result is not replaced with sample data.

## Expected Outcome

[next] A Connected code section immediately below Acceptance criteria lists explicitly declared implementation locations, line ranges, resolution states and the repository source context. Contract and flow previews remain in Linked documents.

## State Changes

[next] Only derived read results, clipboard state or external navigation change. Canonical repository content stays unchanged.

## User-visible Feedback

[next] Show the readable link label and relative path. Display the checked SHA for remote data or Working tree for local observations. With no implementation declaration, show Not linked and explain how an author adds the optional Source / Implementation subsection.

## Edge Cases / Failure Handling

[next] A missing file, blocked path, unavailable read or invalid range has a visible reason and no successful open action. Switching repository or revision replaces both the declarations and their resolution context. A declaration is never rendered as a Passed AC or implemented feature.

## Acceptance Criteria

- [ ] **AC-1:** The shared local and remote specification detail presents Connected code below Acceptance criteria and keeps contract/flow previews separate.
- [ ] **AC-2:** Every declared link displays its label, relative location, optional line range and resolution state; malformed declarations are not silently hidden.
- [ ] **AC-3:** The displayed source context identifies the selected repository and checked SHA or explicitly labels local working-tree observations.
- [ ] **AC-4:** An empty declaration set displays Not linked; a failed resolution displays its failure state rather than a successful sample or zero-error claim.
- [ ] **AC-5:** Displaying a file link never changes review state, declared lifecycle or Not recorded AC verification.

## Permissions / Dependencies

The feature is planned and read-only. It depends on the shared source resolver and caller-provided repository context. Declaring a link does not authorize arbitrary filesystem reads, code execution, repository edits or external writes.

## Observability / Analytics

[next] Consumer-visible resolution states and safe diagnostics identify the specification and relative location. No telemetry, authenticated execution evidence or customer test ingestion is introduced.

## Related Interactions

- [Resolve implementation links](TRC-001-resolve_implementation_links.md)
- [Open implementation source](TRC-001-open_implementation_source.md)
- [View specification detail](../../dsh/DSH-001/DSH-001-view_specification_detail.md)

## Source

- [Contract](../contracts/implementation_links.toml)
- [Flow](../flows/implementation_links.md)
