# Rules flow

## Entry

Open `/rules` for the configured local repository.

## Ready

Read repository rules from the configured sources.

## Empty and failure states

A successful empty load identifies its source. Failed loads show an error and unavailable values. An unknown interaction ID returns not found. Unimplemented adapters remain planned.

## Sources

- [Page contract](contract.toml)
- [Layout](layout.md)
