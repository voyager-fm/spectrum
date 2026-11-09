---
interaction_id: "TRC-001-resolve_implementation_links"
interaction_type: "background"
feature: "Specification implementation links"
category_key: "TRC"
feature_id: "TRC-001"
status: "planned"
phase: "next"
summary: "Resolve explicitly declared implementation file links and optional line ranges within the selected repository source context."
related_region: "cli.output"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Resolve implementation links

## Intent

Resolve explicitly declared implementation file links and optional line ranges within the selected repository source context.

## Trigger / Entry Points

[next] A CLI, plugin or dashboard consumer checks a selected repository containing an optional Implementation subsection in a specification Source section.

## Preconditions

The caller supplies one repository source context. A remote context identifies the checked commit SHA; a local context identifies an observed working tree. No existing code index or additional frontmatter field is required.

## Expected Outcome

[next] Return implementation-link records with the authored label, declaring spec path, resolved repository-relative file path, optional line range, source context and resolution state. Retain failures as records so a consumer can explain them.

## State Changes

[next] Only derived read results, clipboard state or external navigation change. Canonical repository content stays unchanged.

## User-visible Feedback

[next] Distinguish resolved, missing_file, invalid_location, blocked_path and unavailable results. No declaration yields not_linked at the specification level. The result means a location was observed, not that code implements the specification.

## Edge Cases / Failure Handling

Reject absolute paths, external URL declarations, directory targets and paths or symlinks outside the selected repository. A fragment must be empty, L<n> or L<start>-L<end> with positive ordered in-file bounds. An invalid fragment never becomes a successful whole-file link. Preserve safe diagnostics without private absolute or temporary paths.

## Acceptance Criteria

- [ ] **AC-1:** Only normal Markdown links under Source / Implementation become implementation declarations; contract/flow links, inline-code paths, fenced examples, images and prose retain their original meaning.
- [ ] **AC-2:** Each record preserves label, declaring specification, relative file path, line fragment and selected source context; authored order and distinct ranges in the same file are retained.
- [ ] **AC-3:** File absence, invalid location, blocked path and unavailable read remain distinct observable outcomes; missing declarations do not fail otherwise valid specifications.
- [ ] **AC-4:** Repository traversal and external symlink targets are refused before reading source content, and directories are not accepted as implementation files.
- [ ] **AC-5:** Line ranges are positive, ordered and within the observed text; malformed or out-of-range fragments are reported without silent fallback.
- [ ] **AC-6:** Resolution never executes source code or changes document review state, FI lifecycle or AC verification.

## Permissions / Dependencies

The feature is planned and read-only. It depends on the shared source resolver and caller-provided repository context. Declaring a link does not authorize arbitrary filesystem reads, code execution, repository edits or external writes.

## Observability / Analytics

[next] Consumer-visible resolution states and safe diagnostics identify the specification and relative location. No telemetry, authenticated execution evidence or customer test ingestion is introduced.

## Related Interactions

- [Inspect linked implementation](TRC-001-inspect_linked_implementation.md)
- [Open implementation source](TRC-001-open_implementation_source.md)
- [View specification detail](../../dsh/DSH-001/DSH-001-view_specification_detail.md)

## Source

- [Contract](../contracts/implementation_links.toml)
- [Flow](../flows/implementation_links.md)
