# Validation flow

## Contract References

- [Contract](../contracts/validation.toml)

## Interaction Coverage

- [Check repository](../VAL-001/VAL-001-check_repository.md)
- [List specifications](../VAL-001/VAL-001-list_specifications.md)
- [Check with a source profile](../VAL-002/VAL-002-check_with_profile.md)

## Happy Path

1. The user runs `check` or `list` with an optional repository path; the current directory is the default.
2. The CLI reads `.spectrum/config.json`, or the configuration supplied with `--profile`.
3. The shared engine reads the configured inventories, schemas, contracts, flows and Markdown specifications, then checks shape, keys, references, mirrored metadata, ownership and coverage.
4. `check` prints the full result as JSON; `list` prints the interaction specifications sorted by ID. Both exit with status 0 when no structural error exists. Canonical files stay unchanged.

## Failure Handling

- Structural errors appear as findings with a repository path and exit with status 1. Unresolved `TBD` values remain warnings.
- A missing or invalid configuration produces an `invalid-config` finding and status 1.
- A `--profile` flag without a file, an unreadable or malformed profile, an unexpected flag or more than one repository path prints an error and exits with status 1.
- An unknown command prints usage and exits with status 2.
