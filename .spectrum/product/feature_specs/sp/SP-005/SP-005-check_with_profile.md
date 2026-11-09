---
interaction_id: "SP-005-check_with_profile"
interaction_type: "command"
feature: "Source profiles"
category_key: "VAL"
feature_id: "SP-005"
status: "implementing"
phase: "now"
summary: "Check or list a repository through an explicit profile mapping instead of its installed configuration."
related_region: "cli.output"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Check with a source profile

## Intent

Check or list a repository through an explicit profile mapping instead of its installed configuration, so an existing documentation repository can be read before adopting Spectrum.

## Trigger / Entry Points

The user adds `--profile <profile.json>` to `check` or `list`, for example `pnpm cli check /path/to/voyager-documentation --profile /path/to/profile.json`.

## Preconditions

The profile is a readable JSON file in the schema_version 2 configuration shape. Its inventory and document paths are relative to the target repository root. The target repository needs no `.spectrum/config.json`.

## Expected Outcome

The engine uses the profile in place of the installed configuration and returns the same result shape as check or list. Existing IDs, vocabulary and optional columns are read from their current paths.

## State Changes

No file changes. The profile is not installed into the target repository and no source file is moved.

## User-visible Feedback

Findings name paths inside the target repository so the user can tell a malformed source from an unsuitable profile mapping. Missing or unreadable profile files print an error.

## Edge Cases / Failure Handling

`--profile` without a following path, an unreadable file or malformed JSON exits with status 1 before any check. An unexpected flag or more than one repository path exits with status 1. A profile that fails configuration validation produces an `invalid-config` finding. Profile paths that resolve outside the target repository are refused.

## Acceptance Criteria

- [ ] **AC-1:** `--profile` replaces the repository's installed configuration for check and list.
- [ ] **AC-2:** Configured paths outside `.spectrum/` are read in place without relocation.
- [ ] **AC-3:** A missing profile argument, unreadable file or malformed JSON exits with status 1 and checks nothing.
- [ ] **AC-4:** Reading through a profile never writes to the target repository or installs the profile.

## Permissions / Dependencies

Read-only local inspection is executable. Installing a profile as `config.json` or relocating documents needs a separate authorized review in the target repository.

## Observability / Analytics

Local JSON findings and process exit status are available. Profile adoption history is not recorded.

## Related Interactions

- [Check repository](../SP-001/SP-001-check_repository.md)
- [List specifications](../SP-001/SP-001-list_specifications.md)

## Source

- [Contract](../contracts/validation.toml)
- [Flow](../flows/validation.md)
- [Voyager migration guide](../../../../engineering/common/guides/voyager_migration.md)
