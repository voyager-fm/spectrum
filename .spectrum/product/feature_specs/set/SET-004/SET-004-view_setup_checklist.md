---
interaction_id: "SET-004-view_setup_checklist"
interaction_type: "display"
feature: "Repository onboarding"
category_key: "SET"
feature_id: "SET-004"
status: "planned"
phase: "now"
summary: "Report which setup steps a connected repository has at a pinned commit and the command for each missing step."
related_region: "web.repository"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# View setup checklist

## Intent

Guide a connected repository from no Spectrum setup to a working agent setup, and show exactly what is present at one commit.

## Trigger / Entry Points

The user opens a connected repository at `/repositories/{owner}/{repo}`, optionally at `?ref=` or `?pr=`.

## Preconditions

The GitHub App is configured and installed on the repository, and the requested revision resolves to a commit.

## Expected Outcome

For the pinned commit, the page lists these steps with a state for each:

1. The App is installed.
2. `.spectrum/config.json` parses with schema_version 2.
3. `@voyager-fm/spectrum` is declared in `package.json`.
4. An agent integration exists: the repository skills, with their installed version, or the plugin enabled in `.claude/settings.json`.

Each missing step shows the command that completes it. Detection uses `inspectRepositorySetup` from `@spectrum/spec-engine/setup`, so it matches what the CLI writes.

## State Changes

None. The App is read-only, and the snapshot is removed after inspection.

## User-visible Feedback

A done, missing, invalid or not-installed-by-Spectrum state for each step, with a copyable command. The page states that the package is not yet published to npm.

## Edge Cases / Failure Handling

A skill file without the Spectrum marker is shown as not installed by Spectrum, and the page suggests `skills install --force`. It is not shown as done. Symlinked setup files are not followed. A revision that cannot be downloaded shows the error and no checklist.

## Acceptance Criteria

- [ ] **AC-1:** The checklist reports each setup step's state for the pinned commit, using the shared setup inspector.
- [ ] **AC-2:** Every missing step shows the command that completes it, and no step offers a remote write.
- [ ] **AC-3:** Unmanaged skill files and invalid configuration are distinguished from completed steps.

## Permissions / Dependencies

Requires the GitHub App with read access. The page offers no write action: commands are copied and run by the user.

## Observability / Analytics

The checklist is bound to the commit SHA shown on the page. No history is stored.

## Related Interactions

- [Browse remote specifications](../../int/INT-004/INT-004-browse_remote_specifications.md)
- [Initialize repository](../SET-002/SET-002-initialize_repository.md)
- [Install repository skills](../SET-003/SET-003-install_repository_skills.md)

## Source

- [Contract](../contracts/setup.toml)
- [Flow](../flows/setup.md)
- [Distribution architecture](../../../../contracts/distribution.md)
