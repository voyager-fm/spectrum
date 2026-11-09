# Review proposal

## Contract References
- [Approval](../contracts/approval.toml)

## Interaction Coverage
- int-approve-proposal

## Flow
1. Display the proposal diff and validation evidence.
2. The reviewer selects Approve.
3. If the current revision differs, mark the proposal stale and return to review.
4. If it matches, record the reviewed content digest, reviewer, and approval timestamp.
5. Approval does not apply changes or publish externally.

## Failure Handling
If saving approval fails, keep the state in_review and display a retryable error.

