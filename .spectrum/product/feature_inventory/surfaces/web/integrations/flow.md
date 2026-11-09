# Integrations flow

## Entry

Open `/settings` for the configured local repository.

## Ready

Inspect integration connection state reported by the server. Repository configuration does not affect it.

## Empty and failure states

A successful empty load identifies its source. Failed loads show an error and unavailable values. An unknown interaction ID returns not found. Unimplemented adapters remain planned.

## Sources

- [Surface contract](contract.toml)
- [Layout](layout.md)
