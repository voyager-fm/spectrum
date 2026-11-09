# Spec detail flow

## Entry

Open `/specs/[id]` for the configured local repository.

## Ready

Read one interaction, its acceptance criteria and linked sources.

## Empty and failure states

A successful empty load identifies its source. Failed loads show an error and unavailable values. An unknown interaction ID returns not found. Unimplemented adapters remain planned.

## Planned implementation source navigation

[next] After reading an interaction, the user inspects Connected code and its source context. A resolved local location can be copied; a resolved remote location opens GitHub at the checked SHA. Empty, missing, blocked and invalid locations stay visible and offer no successful-open action. Switching repository or revision must replace the displayed locations and their context together.

## Sources

- [Page contract](contract.toml)
- [Layout](layout.md)
- [Implementation-link contract](../../../feature_specs/trc/contracts/implementation_links.toml)
