---
interaction_id: "LOOP-001-review_proposal"
interaction_type: "command"
feature: "Change proposals"
category_key: "LOOP"
feature_id: "LOOP-001"
status: "planned"
phase: "next"
summary: "Review an exact proposal against its base revision before any approved application."
related_region: "web.proposals"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Review proposal

## Intent

Review an exact proposal against its base revision before any approved application.

## Trigger / Entry Points

[next] A person opens an exact proposed change for review.

## Preconditions

A local repository and a schema_version 2 configuration identify canonical documents and inventory schemas. External service authentication is not required for local reads.

## Expected Outcome

[next] The person can review the exact content and its baseline before a separately authorized apply.

## State Changes

[next] A human review may change the proposal review state. Repository writes require revalidation and an implemented apply adapter.

## User-visible Feedback

Show concrete document paths, IDs, findings and declared states. Describe unavailable adapters as planned.

## Edge Cases / Failure Handling

Malformed TSV, JSON schemas, YAML or TOML produce failures. Missing references and symlink escapes produce failures. TBD remains a visible unresolved warning. Missing data is never replaced with a successful sample.

## Acceptance Criteria

- [ ] **AC-1:** A proposed change identifies its base revision and affected specs.
- [ ] **AC-2:** Only a human-approved exact change may be published after revision and file hash revalidation.
- [ ] **AC-3:** Validation failures produce proposed repairs; acceptance criteria are not silently weakened.

## Permissions / Dependencies

Read-only local inspection is executable. Human review annotations do not grant authority to apply, commit, push, merge or post externally.

## Observability / Analytics

Local JSON findings and process exit status are available. Hosted telemetry, model jobs and PR review publication remain unimplemented.

## Related Interactions

- [Check repository](../../val/VAL-001/VAL-001-check_repository.md)
- [Show planned capabilities](../../dsh/DSH-003/DSH-003-show_planned_capabilities.md)
- [Follow spec guardrails](../../agt/AGT-002/AGT-002-follow_spec_guardrails.md)

## Source

- [Contract](../contracts/proposal.toml)
- [Flow](../flows/proposal.md)
- [ChangeSet contract](../../../../../contracts/change-set.md)
