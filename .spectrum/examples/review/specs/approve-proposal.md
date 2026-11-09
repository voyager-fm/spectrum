---
spec_id: spec-approve-proposal
interaction_id: int-approve-proposal
---

# Approve proposal

## Intent
The reviewer approves the exact changes.

## Trigger / Entry Points
Select Approve on the Proposal review screen.

## Preconditions
The proposal is in_review and the reviewer has approval permission.

## Expected Outcome
An approval record is created for the exact content.

## State Changes
Set the state to approved if the revision matches, or stale if it has changed.

## User-visible Feedback
Display Approved after successful approval, or Review again when the revision changes.

## Edge Cases / Failure Handling
Keep the state in_review if saving fails. Duplicate-click handling is TBD.

## Acceptance Criteria
The canonical acceptance criteria are spec-approve-proposal.acceptance_criteria in ../model.json.
The renderer will display AC-1 and AC-2 here. The renderer is not implemented yet.

## Permissions / Dependencies
Approval permission checks are TBD. This example does not grant actual approval permission.

## Observability / Analytics
Record the approval outcome and the reason for a stale state. The personal-data retention policy is TBD.

## Related Interactions
Proposal viewing and change application interactions will be defined later.

## Source
- [Contract](../contracts/approval.toml)
- [Flow](../flows/review.md)

