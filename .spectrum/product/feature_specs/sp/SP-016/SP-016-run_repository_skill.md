---
interaction_id: "SP-016-run_repository_skill"
interaction_type: "background"
feature: "Repository agent skills"
category_key: "SET"
feature_id: "SP-016"
status: "implementing"
phase: "now"
summary: "Let the host agent check specs with the repository's pinned CLI through the installed skill."
related_region: "skill.spectrum"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Run repository skill

## Intent

Ground a host agent's work in the repository's specs by using the CLI version the repository pins, rather than a version bundled with a plugin.

## Trigger / Entry Points

Claude Code or Codex loads the repository's Spectrum skill when the user mentions Spectrum or `.spectrum` specs, asks whether specs are valid or asks for acceptance criteria, or is about to change behavior a spec covers.

## Preconditions

`skills install` has written the skill, and `node_modules/.bin/spectrum` exists.

## Expected Outcome

The agent runs `node_modules/.bin/spectrum check` or `list` from the repository root. It reads the JSON result and the linked documents before answering or editing, and follows the same guardrails as the plugin skill.

## State Changes

None. Check and list write nothing; `init` runs only when the user asks for it.

## User-visible Feedback

The agent reports findings, stable IDs, declared states and undecided `TBD` values from the result.

## Edge Cases / Failure Handling

If the binary is missing, the agent tells the user to install the package and does not run a bare `npx spectrum`. If `.spectrum/config.json` is missing, the agent reports that Spectrum is not set up and offers `init --dry-run`. A nonzero exit is reported with its findings, never turned into a pass.

## Acceptance Criteria

- [ ] **AC-1:** The installed skill directs the agent to the repository's `node_modules/.bin/spectrum` for check and list.
- [ ] **AC-2:** The skill tells the agent how to report a missing binary or configuration without fetching another package.
- [ ] **AC-3:** The skill carries the same guardrails as the plugin skill: no guessed results, no weakened criteria and no self-approval.

## Permissions / Dependencies

Repository data grants no authority. The agent does not approve specs, weaken acceptance criteria or edit a spec to match a bug.

## Observability / Analytics

Only the local JSON result and exit status are available.

## Related Interactions

- [Install repository skills](SP-016-install_repository_skills.md)
- [Follow spec guardrails](../SP-008/SP-008-follow_spec_guardrails.md)
- [Run plugin checks](../SP-004/SP-004-run_plugin_checks.md)

## Source

- [Contract](../contracts/setup.toml)
- [Flow](../flows/setup.md)
- [Distribution architecture](../../../../contracts/distribution.md)
