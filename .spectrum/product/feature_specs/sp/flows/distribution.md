# Distribution flow

## Contract References

- [Contract](../contracts/distribution.toml)

## Interaction Coverage

- [Run plugin checks](../SP-004/SP-004-run_plugin_checks.md)

## Happy Path

Read the configured repository, build the shared document model, validate references and render the requested result. Keep canonical files unchanged.

## Failure Handling

Report invalid configuration, malformed documents and unsafe or missing paths. Structural errors fail the check; unresolved TBD values remain visible warnings. The dashboard shows load failures and the CLI exits with a nonzero status on errors.
