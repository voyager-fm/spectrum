---
interaction_id: "TRC-001-open_implementation_source"
interaction_type: "command"
feature: "Specification implementation links"
category_key: "TRC"
feature_id: "TRC-001"
status: "planned"
phase: "next"
summary: "Copy a local repository-relative implementation location or open the checked GitHub commit location."
related_region: "web.spec_implementation"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Open implementation source

## Intent

Copy a local repository-relative implementation location or open the checked GitHub commit location.

## Trigger / Entry Points

[next] The user selects Copy location for a resolved local link or View on GitHub for a resolved remote link in Connected code.

## Preconditions

The selected link was resolved within the currently displayed repository source context. The target is a file and any line range was validated.

## Expected Outcome

[next] A local action copies the repository-relative location with its optional line fragment. A remote action opens the selected repository blob at the exact checked commit SHA and optional line range.

## State Changes

[next] Only derived read results, clipboard state or external navigation change. Canonical repository content stays unchanged.

## User-visible Feedback

[next] Local copy has an explicit success or failure indication. The remote action identifies GitHub and the pinned source context; a moving branch name is never substituted for the checked SHA.

## Edge Cases / Failure Handling

[next] Copy failure remains visible. Missing, blocked, invalid or unavailable locations have no active open action. The action never substitutes a different repository, source context or line range. Remote URLs are constructed from the trusted repository context and escaped path segments, not an arbitrary authored URL.

## Acceptance Criteria

- [ ] **AC-1:** A resolved local link offers Copy location containing only the repository-relative path and optional validated line fragment.
- [ ] **AC-2:** A resolved remote link opens the selected GitHub repository at the exact checked commit SHA and validated line fragment, with path segments safely encoded.
- [ ] **AC-3:** Missing, blocked, invalid and unavailable targets offer no active successful-open action.
- [ ] **AC-4:** The action does not fall back to a default branch or different repository, and local paths are not sent to a remote service.
- [ ] **AC-5:** Copy and navigation do not write repository files, execute code, grant approval or claim test success.

## Permissions / Dependencies

The feature is planned and read-only. It depends on the shared source resolver and caller-provided repository context. Declaring a link does not authorize arbitrary filesystem reads, code execution, repository edits or external writes.

## Observability / Analytics

[next] Consumer-visible resolution states and safe diagnostics identify the specification and relative location. No telemetry, authenticated execution evidence or customer test ingestion is introduced.

## Related Interactions

- [Resolve implementation links](TRC-001-resolve_implementation_links.md)
- [Inspect linked implementation](TRC-001-inspect_linked_implementation.md)
- [View specification detail](../../dsh/DSH-001/DSH-001-view_specification_detail.md)

## Source

- [Contract](../contracts/implementation_links.toml)
- [Flow](../flows/implementation_links.md)
