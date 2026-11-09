# Connected repository flow

## Contract References

- [Contract](../contracts/connections.toml)

## Interaction Coverage

- [Browse remote specifications](../SP-018/SP-018-browse_remote_specifications.md)
- [View remote specification](../SP-018/SP-018-view_remote_specification.md)
- [Switch repository](../SP-018/SP-018-switch_repository.md)

## Happy Path

1. The user picks a connected repository from the sidebar switcher.
2. The dashboard resolves the default branch, a ref or a pull request head to one commit SHA and reads the specifications from that snapshot.
3. The user opens one specification and follows its source link to the file at the same SHA on GitHub.

## Failure Handling

- An unconfigured App or an installation listing error leaves the local repository available and explains the missing entries.
- A commit without a configuration shows the setup checklist instead of an empty list.
- Download, extraction and check errors are shown as errors, never as sample results.
