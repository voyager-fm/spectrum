# Proposal flow

## Contract References

- [Contract](../contracts/proposal.toml)

## Interaction Coverage

- [Review proposal](../SP-003/SP-003-review_proposal.md)

## Happy Path

[next] Prepare an exact change set, show its diff, collect human review, revalidate revision and hashes, then apply through an implemented adapter.

## Failure Handling

[next] A stale revision or content digest returns the proposal to review. A validation failure produces findings without weakening acceptance criteria. Apply and publication remain unimplemented.
