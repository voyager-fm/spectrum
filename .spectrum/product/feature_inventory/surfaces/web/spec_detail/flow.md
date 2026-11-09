# Spec detail flow

## Entry

Open `/specs/[id]` for the configured local repository.

## Ready

Read one interaction, its acceptance criteria and linked sources. Links inside the document open other interactions and documents in the reader. An interaction declared only in the inventory shows its declared fields and states that no document exists.

## Empty and failure states

A successful empty load identifies its source. Failed loads show an error and unavailable values. An unknown interaction ID returns not found. Unimplemented adapters remain planned.

## Planned implementation source navigation

[next] After reading an interaction, the user inspects Connected code and its source context. A resolved local location can be copied; a resolved remote location opens GitHub at the checked SHA. Empty, missing, blocked and invalid locations stay visible and offer no successful-open action. Switching repository or revision must replace the displayed locations and their context together.

## Sources

- [Surface contract](contract.toml)
- [Layout](layout.md)
- [Implementation-link contract](../../../specs/trc/contracts/implementation_links.toml)
